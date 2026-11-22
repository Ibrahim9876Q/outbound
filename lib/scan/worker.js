const { parentPort, workerData } = require('node:worker_threads');
const { profiles, scanProfile } = require('./browsers');
const { mapTrackers } = require('./trackers');
const dataset = require('../../public/data/site-trackers.json');

async function run() {
  const pending = await profiles();
  const browsers = [];
  for (const profile of pending) {
    browsers.push(await scanProfile(profile));
    parentPort.postMessage({ progress: browsers.length / (pending.length + 1) });
  }
  const summary = { ...mapTrackers(browsers, dataset), appDataBytes: 0 };
  parentPort.postMessage({ status: 'done', progress: 1, browsers, apps: [], summary });
}

run().catch((error) => parentPort.postMessage({ status: 'error', error: `Scan failed (${error.code || error.name}).` }));
