const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs/promises');
const path = require('node:path');
const { profiles, scanProfile } = require('./browsers');
const { mapTrackers } = require('./trackers');
const { scanAppData } = require('./app-data');
const dataset = require('../../public/data/site-trackers.json');
const { collectWindows, permissionHistory, enrichInstalled, autorunInventory, privacyReadout } = require('./windows');
const { profileExtensions } = require('./extensions');

async function run() {
  const warnings = [];
  const collect = async (name, parse) => {
    try { return await parse(await collectWindows(name)); }
    catch { warnings.push(`Could not read ${name}.`); return []; }
  };
  const permissions = collect('permissions', permissionHistory);
  const installed = collect('installed', enrichInstalled);
  const autoruns = collect('autoruns', autorunInventory);
  const windowsPrivacy = collect('windowsPrivacy', privacyReadout);
  const pending = await profiles();
  const browsers = [];
  const extensions = [];
  for (const profile of pending) {
    const [browser, addons] = await Promise.all([scanProfile(profile), profileExtensions(profile)]);
    browsers.push(browser);
    extensions.push(...addons);
    parentPort.postMessage({ progress: 0.7 * browsers.length / (pending.length || 1) });
  }
  const summary = mapTrackers(browsers, dataset);
  parentPort.postMessage({ progress: 0.7 });
  const collected = { permissions: await permissions, installed: await installed, autoruns: await autoruns,
    extensions, windowsPrivacy: await windowsPrivacy };
  const cache = path.join(__dirname, '../../data/appdata-cache.json');
  function publish(apps, background, cachedAt = null) {
    parentPort.postMessage({ status: 'done', progress: 1, browsers, apps,
      summary: { ...summary, appDataBytes: apps.reduce((total, app) => total + app.bytes, 0) },
      appDataTimedOut: background, appDataBackground: background, appDataCachedAt: cachedAt, ...collected, warnings });
  }
  let background = false;
  const { apps } = await scanAppData(workerData, (progress) => {
    parentPort.postMessage({ progress: 0.7 + 0.29 * progress });
  }, process.env, 20000, (partial) => {
    background = true;
    publish(partial, true);
  });
  let cachedAt = Date.now();
  try {
    await fs.mkdir(path.dirname(cache), { recursive: true });
    const temp = `${cache}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ cachedAt, apps }));
    await fs.rename(temp, cache);
  } catch {
    cachedAt = null;
    warnings.push('Could not save the local app-data cache.');
  }
  publish(apps, false, cachedAt);
}

run().catch((error) => parentPort.postMessage({ status: 'error', error: `Scan failed (${error.code || error.name}).` }));
