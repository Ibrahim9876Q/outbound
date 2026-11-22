const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { DeviceWatcher } = require('./devices');

test('usage file is created only after a completed device session', async (t) => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-usage-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const usageFile = path.join(folder, 'data', 'usage.json');
  let mic = [];
  const options = { usageFile, detect: (_detector, script) => script === 'audio-sessions.ps1' ? mic : [] };
  const watcher = new DeviceWatcher(() => {}, options);
  watcher.registryRefreshAt = Infinity;

  await watcher.poll();
  await assert.rejects(fs.stat(usageFile), { code: 'ENOENT' });
  mic = [{ active: true, name: 'Fixture.exe' }];
  await watcher.poll();
  await assert.rejects(fs.stat(usageFile), { code: 'ENOENT' });
  mic = [];
  await watcher.poll();

  const restored = new DeviceWatcher(() => {}, options);
  assert.equal(restored.history.mic.length, 1);
  assert.equal(restored.history.mic[0].app, 'Fixture');
  assert.ok(restored.history.mic[0].stop >= restored.history.mic[0].start);
});
