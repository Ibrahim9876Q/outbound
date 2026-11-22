const { execFile } = require('node:child_process');
const path = require('node:path');

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

module.exports = { collectWindows, filetimeToMs, permissionHistory };
