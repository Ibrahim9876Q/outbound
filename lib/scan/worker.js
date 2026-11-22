const { parentPort, workerData } = require('node:worker_threads');
const { profiles, scanProfile } = require('./browsers');
const { mapTrackers } = require('./trackers');
const { scanAppData } = require('./app-data');
const dataset = require('../../public/data/site-trackers.json');
const { collectWindows, permissionHistory } = require('./windows');

async function run() {
  const warnings = [];
  const collect = async (name, parse) => {
    try { return parse(await collectWindows(name)); }
    catch { warnings.push(`Could not read ${name}.`); return []; }
  };
  const permissions = collect('permissions', permissionHistory);
  const pending = await profiles();
  const browsers = [];
  for (const profile of pending) {
    browsers.push(await scanProfile(profile));
    parentPort.postMessage({ progress: 0.7 * browsers.length / (pending.length || 1) });
  }
  const summary = mapTrackers(browsers, dataset);
  parentPort.postMessage({ progress: 0.7 });
  const { apps, appDataTimedOut } = await scanAppData(workerData, (progress) => {
    parentPort.postMessage({ progress: 0.7 + 0.29 * progress });
  });
  summary.appDataBytes = apps.reduce((total, app) => total + app.bytes, 0);
  parentPort.postMessage({ status: 'done', progress: 1, browsers, apps, summary, appDataTimedOut,
    permissions: await permissions, warnings });
}

run().catch((error) => parentPort.postMessage({ status: 'error', error: `Scan failed (${error.code || error.name}).` }));
