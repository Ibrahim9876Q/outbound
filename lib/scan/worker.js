const { parentPort, workerData } = require('node:worker_threads');
const { profiles, scanProfile } = require('./browsers');

async function run() {
  const pending = await profiles();
  const browsers = [];
  for (const profile of pending) {
    browsers.push(await scanProfile(profile));
    parentPort.postMessage({ progress: browsers.length / (pending.length + 1) });
  }
  const summary = {
    sitesVisited: new Set(browsers.flatMap((b) => b.sites.map((s) => s.domain))).size,
    sitesWithTrackers: 0, trackerCompanies: 0,
    cookieDomains: new Set(browsers.flatMap((b) => b.cookieDomains.map((c) => c.domain))).size,
    trackerCookieDomains: 0, appDataBytes: 0, topTrackers: [],
  };
  parentPort.postMessage({ status: 'done', progress: 1, browsers, apps: [], summary });
}

run().catch((error) => parentPort.postMessage({ status: 'error', error: `Scan failed (${error.code || error.name}).` }));
