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
  worker.emit('message', { status: 'done', progress: 1, appDataBackground: false,
    permissions: [{ capability: 'location' }] });
  assert.equal(scan.view().cached, false);
  const finishedAt = scan.view().finishedAt;
  const restarted = new StoredScan(options);
  assert.equal(restarted.view().cached, true);
  assert.equal(restarted.view().finishedAt, finishedAt);
  restarted.start([]);
  worker.emit('message', { progress: 0.4 });
  assert.equal(restarted.view().progress, 0.4);
  assert.equal(restarted.view().permissions.length, 0);
  assert.equal(restarted.view().previous.permissions.length, 1);
  assert.deepEqual(restarted.status().previous, { finishedAt, cached: true });
  assert.equal(restarted.status().counts.permissions, 0);
  assert(!Object.hasOwn(restarted.status(), 'permissions'));
  worker.emit('message', { status: 'done', progress: 1, appDataBackground: true });
  assert.equal(new StoredScan(options).view().finishedAt, finishedAt);
  worker.emit('error', new Error('fixture'));
  assert.equal(restarted.view().previous.finishedAt, finishedAt);
  assert.equal(new StoredScan(options).view().finishedAt, finishedAt);
  restarted.start([]);
  worker.emit('message', { status: 'done', progress: 1, appDataBackground: false,
    permissions: [{ capability: 'webcam' }] });
  assert.equal(restarted.view().previous, undefined);
  assert.equal(new StoredScan(options).view().permissions[0].capability, 'webcam');
});
