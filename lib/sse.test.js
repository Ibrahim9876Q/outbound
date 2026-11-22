const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { StateStream } = require('./sse');

test('sends initial state and heartbeat and releases 50 disconnected listeners', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const stream = new StateStream(() => ({ apps: [] }));
  const baseline = stream.clients.size;
  const clients = Array.from({ length: 50 }, () => {
    const messages = [];
    const res = Object.assign(new EventEmitter(), {
      writeHead(status, headers) {
        assert.equal(status, 200);
        assert.equal(headers['Content-Type'], 'text/event-stream');
      },
      write(message) { messages.push(message); },
    });
    stream.connect(res);
    assert.equal(messages[0], 'event: state\ndata: {"apps":[]}\n\n');
    return { res, messages };
  });
  assert.equal(stream.clients.size, baseline + 50);
  t.mock.timers.tick(14999);
  stream.flush();
  assert.match(clients[0].messages.at(-1), /^event: state/);
  t.mock.timers.tick(1);
  stream.flush();
  for (const { res, messages } of clients) {
    assert.match(messages.at(-1), /^: heartbeat\n\n/);
    res.emit('close');
    assert.equal(res.listenerCount('close'), 0);
  }
  assert.equal(stream.clients.size, baseline);
});
