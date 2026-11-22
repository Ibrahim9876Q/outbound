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
    try {
      const rows = await parse(await collectWindows(name));
      parentPort.postMessage({ [name]: rows });
      return rows;
    }
    catch { warnings.push(`Could not read ${name}.`); return []; }
  };
  const permissions = collect('permissions', permissionHistory);
  const installed = collect('installed', enrichInstalled);
  const autoruns = collect('autoruns', autorunInventory);
  const windowsPrivacy = collect('windowsPrivacy', privacyReadout);
  let browserProgress = 0;
  let folderProgress = 0;
  let published = false;
  const showProgress = () => {
    if (!published) parentPort.postMessage({ progress: 0.7 * browserProgress + 0.29 * folderProgress });
  };
  const partial = Promise.withResolvers();
  const fullWalk = scanAppData(workerData, (progress) => {
    folderProgress = progress;
    showProgress();
  }, process.env, 20000, (apps) => partial.resolve({ apps, background: true }))
    .then(({ apps }) => ({ apps, background: false }));
  const foreground = Promise.race([partial.promise, fullWalk]);
  foreground.catch(() => {});
  const pending = await profiles();
  const browsers = [];
  const extensions = [];
  for (const profile of pending) {
    const [browser, addons] = await Promise.all([scanProfile(profile), profileExtensions(profile)]);
    browsers.push(browser);
    extensions.push(...addons);
    browserProgress = browsers.length / pending.length;
    showProgress();
  }
  const summary = mapTrackers(browsers, dataset);
  parentPort.postMessage({ browsers, extensions });
  browserProgress = 1;
  showProgress();
  const collected = { permissions: await permissions, installed: await installed, autoruns: await autoruns,
    extensions, windowsPrivacy: await windowsPrivacy };
  const cache = path.join(__dirname, '../../data/appdata-cache.json');
  function publish(apps, background, cachedAt = null) {
    published = true;
    parentPort.postMessage({ status: 'done', progress: 1, browsers, apps,
      summary: { ...summary, appDataBytes: apps.reduce((total, app) => total + app.bytes, 0) },
      appDataTimedOut: background, appDataBackground: background, appDataCachedAt: cachedAt, ...collected, warnings });
  }
  const first = await foreground;
  if (first.background) publish(first.apps, true);
  const { apps } = await fullWalk;
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
