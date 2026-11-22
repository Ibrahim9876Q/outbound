const assert = require('node:assert/strict');
const test = require('node:test');
const { NetworkWatcher } = require('./network');

test('retains all live destinations and the newest 80 recent inactive destinations per app', () => {
  const watcher = new NetworkWatcher(() => {});
  const now = 1_000_000;
  for (const app of ['chrome.exe', 'edge.exe']) {
    for (let i = 0; i < 100; i++) {
      watcher.flows.set(`${app}|${i}`, { app, lastSeen: now - i, active: false });
    }
    watcher.flows.set(`${app}|expired`, { app, lastSeen: now - 600_001, active: false });
    watcher.flows.set(`${app}|live`, { app, lastSeen: now - 600_001, active: true });
  }
  watcher.pruneInactive(now);
  assert.equal(watcher.flows.size, 162);
  for (const app of ['chrome.exe', 'edge.exe']) {
    assert(watcher.flows.has(`${app}|live`));
    assert(!watcher.flows.has(`${app}|expired`));
    for (let i = 0; i < 100; i++) assert.equal(watcher.flows.has(`${app}|${i}`), i < 80);
  }
});
