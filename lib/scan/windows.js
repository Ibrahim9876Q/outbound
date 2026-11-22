const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');

function collectWindows(collector) {
  if (process.platform !== 'win32') return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, '..', '..', 'scripts', 'scan-windows.ps1'), '-Collector', collector],
    { windowsHide: true, timeout: 18000, maxBuffer: 16 * 1024 * 1024 }, (error, output) => {
      if (error) return reject(new Error(`Could not read Windows ${collector}.`));
      try { resolve(JSON.parse(output)); } catch { reject(new Error(`Invalid Windows ${collector} response.`)); }
    });
  });
}

function filetimeToMs(value) {
  try {
    const ticks = BigInt(value);
    const unix = Number(ticks / 10000n - 11644473600000n);
    return ticks > 0 && Number.isFinite(unix) && Math.abs(unix) <= 8640000000000000 ? unix : null;
  } catch { return null; }
}

function permissionHistory(rows) {
  const results = new Map();
  for (const row of rows) {
    const exe = row.nonPackaged ? row.key.replace(/#/g, '\\') : null;
    const app = exe ? path.win32.basename(exe) : row.key;
    const key = JSON.stringify([row.capability.toLowerCase(), (exe || app).toLowerCase()]);
    const previous = results.get(key);
    const start = filetimeToMs(row.start);
    const inUse = start !== null && row.stop === '0';
    const newest = !previous || (start ?? -Infinity) >= (previous.lastUsedStart ?? -Infinity);
    results.set(key, {
      capability: row.capability, app, exe, allowed: row.permission ?? previous?.allowed ?? null,
      lastUsedStart: newest ? start : previous.lastUsedStart,
      lastUsedStop: newest ? filetimeToMs(row.stop) : previous.lastUsedStop,
      inUse: newest ? inUse : previous.inUse,
    });
  }
  return [...results.values()].sort((a, b) => (b.lastUsedStart ?? 0) - (a.lastUsedStart ?? 0));
}

function installDate(value) {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return null;
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  const time = Date.parse(iso);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(iso) ? iso : null;
}

const identity = (value) => String(value ?? '').toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]/g, '');

function installedInventory(rows, dossier = []) {
  const ids = new Map();
  for (const app of dossier) {
    for (const name of [app.name, ...(app.processNames ?? [])]) {
      const key = identity(name);
      if (key) ids.set(key, app.id);
    }
  }
  return rows.map(({ name, publisher, version, installDate: date, sizeBytes, source, icon }) => {
    const exe = typeof icon === 'string' && icon.match(/([^\\/"]+\.exe)(?:[" ,]|$)/i)?.[1];
    const researchId = ids.get(identity(name)) ?? ids.get(identity(exe));
    const entry = { name, publisher: publisher ?? null, version: version ?? null, installDate: installDate(date),
      sizeBytes: Number.isSafeInteger(sizeBytes) && sizeBytes >= 0 ? sizeBytes : null, source };
    if (researchId) entry.researchId = researchId;
    return entry;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function enrichInstalled(rows) {
  let apps = [];
  try { apps = JSON.parse(await fs.readFile(path.join(__dirname, '../../public/data/research.json'), 'utf8')).apps; }
  catch { /* dossier is optional */ }
  return installedInventory(rows, apps);
}

function autorunInventory(rows) {
  return rows.flatMap((row) => {
    const label = `${row.name} ${row.publisher ?? ''} ${row.description ?? ''}`;
    const reason = /telemetry|diagtrack|dmwappushservice|diagnostics?|compatibility appraiser|tracking/i.test(label)
      ? 'Name or description suggests telemetry, diagnostics, or tracking.'
      : /updat(?:e|er|ing)|\bads?\b|advertis/i.test(label)
        ? 'Name or publisher suggests updates or advertising.' : null;
    if (row.kind === 'service' && !/telemetry|diagtrack|dmwappushservice|diagnostics?|tracking/i.test(label)) return [];
    const { kind, name, command, publisher, status, startType, triggers } = row;
    return [{ kind, name, command: command ?? '', ...(publisher ? { publisher } : {}),
      ...(status ? { status } : {}), ...(startType ? { startType } : {}), ...(triggers ? { triggers } : {}),
      flagged: Boolean(reason), reason }];
  });
}

// Policy semantics: https://learn.microsoft.com/windows/privacy/windows-privacy-compliance-guide
function privacyReadout(rows) {
  return rows.map(({ setting, value, mode }) => {
    let meaning = 'No value found in the inspected registry keys.';
    let recommended = 'Review the setting in Windows Privacy & security.';
    if (mode === 'diagnostic') {
      meaning = ({ 0: 'Diagnostic data off policy (edition dependent).', 1: 'Required diagnostic data.',
        2: 'Enhanced diagnostic data policy (legacy).', 3: 'Optional diagnostic data.' })[value] ?? 'Unrecognized diagnostic data level.';
      recommended = 'Choose the lowest diagnostic level available for your Windows edition.';
    } else if (mode === 'disabledPolicy') {
      meaning = value === 1 ? 'Disabled by policy.' : 'This policy does not disable the setting.';
    } else if (mode === 'restriction') {
      meaning = value === 1 ? 'Implicit text collection is restricted.' : 'This value does not restrict implicit text collection.';
    } else if (mode === 'consent') {
      meaning = 'ConsentStore reports ' + value + ' for location.';
    } else if (mode === 'enabled') {
      meaning = value === 1 ? 'Enabled according to this registry value.' :
        value === 0 ? 'Disabled according to this registry value.' : 'Unrecognized value.';
    }
    return { setting, value: value ?? null, meaning, recommended };
  });
}

module.exports = { collectWindows, filetimeToMs, permissionHistory, installedInventory, enrichInstalled, autorunInventory, privacyReadout };
