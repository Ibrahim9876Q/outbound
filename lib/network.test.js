const assert = require('node:assert/strict');
const test = require('node:test');
const { NetworkWatcher } = require('./network');
const { SeenCompanies } = require('./seen');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

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

test('counts only newly observed sockets from apps outside the sampled foreground', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-observations-'));
  const file = path.join(directory, 'seen.json');
  t.after(async () => {
    await fs.unlink(file);
    await fs.rmdir(directory);
  });
  const events = [];
  const watcher = new NetworkWatcher((event) => events.push(event));
  watcher.seenCompanies = new SeenCompanies(file);
  watcher.foreground.current = () => 1;
  watcher.lookupPtr = () => {};
  watcher.describeIp = (ip) => ({ org: ip.endsWith('.1') ? 'First Owner' : 'Other Owner', tracker: ip.endsWith('.2'), country: 'CA' });
  const names = new Map([[1, 'Browser.exe'], [2, 'Player.exe'], [3, 'Browser.exe']]);
  const now = Date.now();
  const socket = (pid, port, ip) => ({
    pid, state: 'ESTABLISHED', local: { ip: '192.168.1.2', port }, remote: { ip, port: 443 },
  });
  const existing = socket(2, 40000, '8.8.8.1');
  await watcher.applyConnections([existing], names, now);
  assert.equal(watcher.snapshot().apps[0].background.connections, 0);
  const newBackground = socket(2, 40001, '8.8.8.2');
  const foregroundSibling = socket(3, 40002, '8.8.8.2');
  const secondScan = [existing, newBackground, newBackground, foregroundSibling];
  await watcher.applyConnections(secondScan, names, now + 1000);
  await watcher.applyConnections(secondScan, names, now + 2000);
  const apps = watcher.snapshot().apps;
  assert.deepEqual(apps.find((app) => app.id === 'player.exe').background,
    { connections: 1, companies: ['Other Owner'], trackers: ['Other Owner'] });
  assert.equal(apps.find((app) => app.id === 'browser.exe').background.connections, 0);
  assert.equal(events.filter((event) => event.type === 'background-talk').length, 1);
  assert.deepEqual(events.filter((event) => event.type === 'new-company').map((event) => event.org),
    ['First Owner', 'Other Owner']);
  assert.equal(apps.flatMap((app) => app.destinations).filter((d) => d.firstSeenEver).length, 2);
  const reloaded = new SeenCompanies(file);
  assert.equal(reloaded.observe(' OTHER OWNER ', now + 3000), false);
  assert.equal(reloaded.observe('Unknown owner', now + 3000), false);
});
