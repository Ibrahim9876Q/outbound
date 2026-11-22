const { join, win32 } = require('node:path');
const { friendlyAppName } = require('../orgs');
const { validProgram } = require('./policy');
const { runPoll } = require('../poll');

const key = (name) => String(name ?? '').toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]/g, '');
const PROCESS_SCRIPT = join(__dirname, '..', '..', 'scripts', 'procinfo.ps1');
let programLookup;

function runningPrograms() {
  if (process.platform !== 'win32') return [];
  programLookup ??= runPoll('policy program lookup', 'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PROCESS_SCRIPT, '-PathsOnly'],
    { timeout: 5000, parse: (text) => [].concat(JSON.parse(text.trim() || '[]')).map((row) =>
      ({ Name: row?.ProcessName, ExecutablePath: row?.Path })) })
    .finally(() => { programLookup = null; });
  return programLookup;
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
