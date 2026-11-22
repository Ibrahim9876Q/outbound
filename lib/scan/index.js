const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { staleAutoruns } = require('./autoruns');

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
    try {
      const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (saved?.status === 'done' && !saved.appDataBackground && Number.isFinite(saved.finishedAt) &&
          Array.isArray(saved.browsers) && Array.isArray(saved.apps)) {
        this.result = { ...initial(), ...saved, cached: true };
        this.completed = this.result;
      }
    } catch { /* no readable completed scan yet */ }
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
    const counts = Object.fromEntries(['browsers', 'apps', 'permissions', 'installed', 'autoruns', 'extensions', 'windowsPrivacy']
      .map((section) => [section, this.result[section].length]));
    const previous = this.completed && this.completed !== this.result
      ? { finishedAt: this.completed.finishedAt, cached: true } : null;
    return { status, startedAt, finishedAt, progress, cached, appDataBackground, appDataCachedAt,
      counts, warningCount: warnings.length, previous, ...(error ? { error } : {}) };
  }

  remember(result) {
    this.completed = result;
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
