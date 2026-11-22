const path = require('node:path');
const { Worker } = require('node:worker_threads');

function initial() {
  return {
    status: 'idle', startedAt: null, finishedAt: null, progress: 0, browsers: [], apps: [],
    permissions: [], installed: [], autoruns: [], warnings: [],
    summary: { sitesVisited: 0, sitesWithTrackers: 0, trackerCompanies: 0,
      cookieDomains: 0, trackerCookieDomains: 0, appDataBytes: 0, topTrackers: [] },
  };
}

class StoredScan {
  constructor() { this.result = initial(); }

  start(apps) {
    if (this.result.status === 'running') return null;
    const startedAt = Date.now();
    this.result = { ...initial(), status: 'running', startedAt };
    const finish = (update) => {
      if (this.result.startedAt !== startedAt || this.result.status !== 'running') return;
      this.result = { ...this.result, ...update, ...(update.status ? { finishedAt: Date.now() } : {}) };
    };
    try {
      const worker = new Worker(path.join(__dirname, 'worker.js'), { workerData: apps });
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
