const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { staleAutoruns } = require('./autoruns');
const { isRecord, readLocalJson } = require('../local-json');

const SECTIONS = ['browsers', 'apps', 'permissions', 'installed', 'autoruns', 'extensions', 'windowsPrivacy'];

function validCache(saved) {
  return saved?.status === 'done' && !saved.appDataBackground && Number.isFinite(saved.finishedAt) &&
    SECTIONS.every((key) => Array.isArray(saved[key]) && saved[key].every(isRecord)) &&
    saved.browsers.every((browser) => Array.isArray(browser.sites) &&
      browser.sites.every((site) => typeof site?.domain === 'string' && Array.isArray(site.trackers) && site.trackers.every(isRecord)) &&
      Array.isArray(browser.cookieDomains)) &&
    isRecord(saved.summary) && Array.isArray(saved.summary.topTrackers) && saved.summary.topTrackers.every(isRecord) &&
    Array.isArray(saved.warnings);
}

function initial() {
  return {
    status: 'idle', startedAt: null, finishedAt: null, progress: 0, browsers: [], apps: [],
    permissions: [], installed: [], autoruns: [], extensions: [], windowsPrivacy: [], warnings: [],
    appDataBackground: false, appDataCachedAt: null,
    cached: false,
    summary: { sitesVisited: 0, sitesWithTrackers: 0, trackerCompanies: 0,
      cookieDomains: 0, trackerCookieDomains: 0, appDataBytes: 0, topTrackers: [] },
  };
}

class StoredScan {
  constructor({
    cacheFile = path.join(__dirname, '../../data/scan-cache.json'),
    makeWorker = (data) => new Worker(path.join(__dirname, 'worker.js'), { workerData: data }),
  } = {}) {
    this.cacheFile = cacheFile;
    this.makeWorker = makeWorker;
    this.result = initial();
    this.completed = null;
    const saved = readLocalJson(cacheFile, 'the scan cache', validCache, (warning) => {
      this.result.warnings.push(warning);
      console.warn(warning);
    });
    if (saved) this.completed = this.result = { ...initial(), ...saved, cached: true };
  }

  view() {
    if (!this.completed || this.completed === this.result) return this.result;
    if (this.viewSource !== this.result) {
      this.viewSource = this.result;
      this.viewCache = { ...this.result, previous: { ...this.completed, cached: true } };
    }
    return this.viewCache;
  }

  status() {
    const { status, startedAt, finishedAt, progress, cached, appDataBackground, appDataCachedAt, warnings, error } = this.result;
    const counts = Object.fromEntries(SECTIONS.map((section) => [section, this.result[section].length]));
    const previous = this.completed && this.completed !== this.result
      ? { finishedAt: this.completed.finishedAt, cached: true } : null;
    return { status, startedAt, finishedAt, progress, cached, appDataBackground, appDataCachedAt,
      counts, warningCount: warnings.length, previous, ...(error ? { error } : {}) };
  }

  remember(result) {
    this.completed = result;
    this.viewSource = null;
    this.viewCache = null;
    try {
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      const temp = `${this.cacheFile}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(result));
      fs.renameSync(temp, this.cacheFile);
    } catch {
      this.completed = this.result = { ...result, warnings: [...result.warnings, 'Could not save the completed local scan.'] };
    }
  }

  start(apps) {
    if (this.result.status === 'running' || this.result.appDataBackground) return null;
    const startedAt = Date.now();
    const run = {};
    this.run = run;
    const previousAutoruns = this.completed?.autoruns ?? [];
    this.result = { ...initial(), status: 'running', startedAt, autoruns: staleAutoruns(previousAutoruns) };
    const finish = (update) => {
      if (this.run !== run || (this.result.status !== 'running' && !this.result.appDataBackground)) return;
      if (this.result.status === 'done' && !update.status) return;
      if (this.result.status === 'done' && update.status === 'error') {
        this.result = { ...this.result, appDataBackground: false, warnings: [...this.result.warnings, update.error] };
        return;
      }
      this.result = { ...this.result, ...update, ...(update.status && !this.result.finishedAt ? { finishedAt: Date.now() } : {}) };
      if (this.result.status === 'done' && !this.result.appDataBackground) this.remember(this.result);
    };
    try {
      const worker = this.makeWorker({ apps, previousAutoruns });
      worker.on('message', finish);
      worker.on('error', () => finish({ status: 'error', error: 'The local scan worker failed.' }));
      worker.on('exit', () => finish({ status: 'error', error: 'The local scan worker stopped before reporting results.' }));
    } catch {
      finish({ status: 'error', error: 'Could not start the local scan worker.' });
    }
    return startedAt;
  }
}

module.exports = { StoredScan };
