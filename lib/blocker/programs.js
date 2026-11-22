const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { win32 } = require('node:path');
const { friendlyAppName } = require('../orgs');
const { validProgram } = require('./policy');

const execute = promisify(execFile);
const key = (name) => String(name ?? '').toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]/g, '');

async function runningPrograms() {
  if (process.platform !== 'win32') return [];
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$ErrorActionPreference="Stop"; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ' +
    '@(Get-CimInstance Win32_Process | Where-Object ExecutablePath | Select-Object Name, ExecutablePath) | ConvertTo-Json -Compress'],
  { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 });
  const rows = JSON.parse(stdout || '[]');
  return Array.isArray(rows) ? rows : [rows];
}

function createProgramResolver({ list = runningPrograms, apps = require('../../public/data/research.json').apps } = {}) {
  return async (name) => {
    const target = key(name);
    if (!target) return [];
    const appKeys = new Set([target]);
    for (const app of apps) {
      const names = [app.id, app.name, ...app.processNames].map(key);
      if (names.includes(target)) for (const alias of names) appKeys.add(alias);
    }
    const paths = new Map();
    for (const row of await list()) {
      if (!row?.ExecutablePath || !validProgram(row.ExecutablePath)) continue;
      const exe = row.Name || win32.basename(row.ExecutablePath);
      if (!appKeys.has(key(exe)) && !appKeys.has(key(friendlyAppName(exe)))) continue;
      paths.set(row.ExecutablePath.toLowerCase(), row.ExecutablePath);
    }
    return [...paths.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, program]) => program);
  };
}

module.exports = { createProgramResolver };
