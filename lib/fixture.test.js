const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { fixtureApi, fixtureHtml, loadFixture } = require('./fixture');
const { StateStream } = require('./sse');

function state() {
  return { fresh: true, at: 100, sampledAt: 90, home: { lat: 0, lng: 0 },
    apps: Array.from({ length: 80 }, (_, index) => ({ id: `test-${index}.exe`, name: `Test ${index}`, destinations: [] })),
    events: [], links: [], legacyLinks: [], devices: { mic: { apps: [] }, camera: { apps: [] } } };
}

test('fixture replay requires an explicit path and a fresh 80-app snapshot', async (t) => {
  assert.throws(() => loadFixture(''), /Set OUTBOUND_FIXTURE/);
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-replay-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const file = path.join(folder, 'recording.json');
  const recorded = state();
  await fs.writeFile(file, JSON.stringify(recorded));
  assert.deepEqual(loadFixture(file), { ...recorded, banner: 'FIXTURE DATA' });
  for (const change of [{ fresh: false }, { banner: 'FIXTURE DATA' }, { apps: recorded.apps.slice(1) },
    { apps: Array(80).fill(recorded.apps[0]) }]) {
    await fs.writeFile(file, JSON.stringify({ ...recorded, ...change }));
    assert.throws(() => loadFixture(file), /80 distinct apps/);
  }
  await fs.writeFile(file, '{');
  assert.throws(() => loadFixture(file), /readable local JSON recording/);
});

test('replay labels the dashboard, every API result and each state frame', () => {
  const html = fixtureHtml('<head><title>Outbound</title></head><header><h1>Outbound</h1></header>');
  assert.match(html, /<title>FIXTURE DATA \| Outbound<\/title>/);
  assert.match(html, /<header>.*outbound-fixture-banner.*>FIXTURE DATA<\/strong><\/header>/);
  const snapshot = { ...state(), banner: 'FIXTURE DATA' };
  const stream = new StateStream(() => snapshot);
  const frames = [];
  const live = Object.assign(new EventEmitter(), { writeHead: (status) => assert.equal(status, 200),
    write: (frame) => frames.push(frame) });
  const call = (method, route, res) => fixtureApi({ method }, res, new URL(route, 'http://127.0.0.1'), snapshot, stream);
  assert.equal(call('GET', '/events', live), true);
  stream.flush();
  assert.equal(frames.length, 2);
  for (const frame of frames) assert.deepEqual(JSON.parse(frame.split('\ndata: ')[1]), snapshot);
  live.emit('close');
  for (const [method, route, expectedStatus] of [['GET', '/api/state', 200], ['POST', '/api/scan', 405],
    ['GET', '/api/history', 503], ['GET', '/auth/login', 503]]) {
    assert.equal(call(method, route, { writeHead: (status) => assert.equal(status, expectedStatus), end: (body) => {
      const result = JSON.parse(body);
      assert.equal(result.banner, 'FIXTURE DATA');
      if (expectedStatus === 200) assert.deepEqual(result, snapshot);
    } }), true);
  }
  assert.equal(call('GET', '/style.css', {}), false);
});
