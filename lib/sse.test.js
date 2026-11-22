const assert = require('node:assert/strict');
const http = require('node:http');
const { setTimeout: sleep } = require('node:timers/promises');
const test = require('node:test');
const { StateStream } = require('./sse');

test('sends initial state and heartbeat and releases 50 disconnected listeners', async (t) => {
  const stream = new StateStream(() => ({ apps: [] }));
  const server = http.createServer((req, res) => stream.connect(res));
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/events`;
  const baseline = stream.clients.size;
  const readers = await Promise.all(Array.from({ length: 50 }, async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const reader = response.body.getReader();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'event: state\ndata: {"apps":[]}\n\n');
    return reader;
  }));
  assert.equal(stream.clients.size, baseline + 50);
  stream.flush(Date.now() + 15000);
  const heartbeat = new TextDecoder().decode((await readers[0].read()).value);
  assert.match(heartbeat, /^: heartbeat\n\n/);
  await Promise.all(readers.map((reader) => reader.cancel()));
  for (let i = 0; stream.clients.size !== baseline && i < 100; i++) await sleep(20);
  assert.equal(stream.clients.size, baseline);
});
