const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { StoredScan } = require('./index');

test('retains the completed scan during rescan and restores it after restart', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-scan-cache-'));
  const cacheFile = path.join(directory, 'scan-cache.json');
  t.after(async () => { await fs.unlink(cacheFile); await fs.rmdir(directory); });
  let worker;
  const options = { cacheFile, makeWorker: () => (worker = new EventEmitter()) };
  const scan = new StoredScan(options);
  assert.equal(scan.view().status, 'idle');
  scan.start([]);
  worker.emit('message', { status: 'done', progress: 1, appDataBackground: false, finishedAt: 100,
    permissions: [{ capability: 'location' }] });
  assert.equal(scan.view().cached, false);
  const restarted = new StoredScan(options);
  assert.equal(restarted.view().cached, true);
  assert.equal(restarted.view().finishedAt, 100);
  restarted.start([]);
  worker.emit('message', { progress: 0.4 });
  assert.equal(restarted.view().progress, 0.4);
  assert.equal(restarted.view().permissions.length, 0);
  assert.equal(restarted.view().previous.permissions.length, 1);
  worker.emit('message', { status: 'done', progress: 1, appDataBackground: true });
  assert.equal(new StoredScan(options).view().finishedAt, 100);
  worker.emit('error', new Error('fixture'));
  assert.equal(restarted.view().previous.finishedAt, 100);
  assert.equal(new StoredScan(options).view().finishedAt, 100);
});
