const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const net = require('node:net');
const { once } = require('node:events');
const { test } = require('node:test');
const { startDns } = require('./dns');

const host = '127.0.0.1';

function name(domain) {
  return Buffer.concat([...domain.split('.').map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])), Buffer.from([0])]);
}

function query(domain) {
  return Buffer.concat([Buffer.from('beef01000001000000000000', 'hex'), name(domain), Buffer.from('00010001', 'hex')]);
}

function answer(request, target) {
  const response = Buffer.from(request);
  response.writeUInt16BE(0x8180, 2);
  response.writeUInt16BE(1, 6);
  const header = Buffer.from('c00c000100010000003c0004', 'hex');
  const value = target ? name(target) : Buffer.from([192, 0, 2, 1]);
  header.writeUInt16BE(target ? 5 : 1, 2);
  header.writeUInt16BE(value.length, 10);
  return Buffer.concat([response, header, value]);
}

function frame(packet) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(packet.length);
  return Buffer.concat([length, packet]);
}

async function lookup(port, domain, transport) {
  const packet = query(domain);
  if (transport === 'tcp') {
    const socket = net.createConnection(port, host);
    try {
      socket.setTimeout(3000, () => socket.destroy(new Error('DNS test timed out')));
      socket.write(frame(packet));
      let response = Buffer.alloc(0);
      for await (const chunk of socket) {
        response = Buffer.concat([response, chunk]);
        if (response.length > 2 && response.length >= response.readUInt16BE() + 2) return response.subarray(2);
      }
      throw new Error('DNS test connection ended early');
    } finally {
      socket.destroy();
    }
  }
  const socket = dgram.createSocket('udp4');
  try {
    const response = once(socket, 'message', { signal: AbortSignal.timeout(3000) });
    socket.send(packet, port, host);
    return (await response)[0];
  } finally {
    socket.close();
  }
}

test('DNS forwards ordinary names and requires approval for trackers and CNAME targets', async (t) => {
  const upstream = dgram.createSocket('udp4');
  t.after(() => upstream.close());
  upstream.bind(0, host);
  await once(upstream, 'listening');
  const port = upstream.address().port;
  const requests = [];
  let revokeOnUpstream = false;
  function respond(packet) {
    requests.push(packet);
    if (revokeOnUpstream) approved = false;
    const alias = packet.includes(name('alias.example'));
    return answer(packet, alias ? 'test.google-analytics.com' : null);
  }
  upstream.on('message', (packet, peer) => upstream.send(respond(packet), peer.port, peer.address));
  const tcp = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 2 || buffer.length < buffer.readUInt16BE() + 2) return;
      socket.end(frame(respond(buffer.subarray(2))));
    });
  });
  t.after(() => tcp.close());
  tcp.listen(port, host);
  await once(tcp, 'listening');
  let approved = false;
  const events = [];
  const errors = [];
  const gateway = await startDns({
    host, port: 0, client: host, upstreams: [{ host, port }],
    allowTracker: async (domain) => approved && domain === 'google-analytics.com',
    onLookup: (event) => events.push(event),
    onError: (error) => errors.push(error),
  });
  t.after(gateway.close);

  for (const transport of ['udp', 'tcp']) {
    const regular = await lookup(gateway.port, 'regular.example', transport);
    assert.equal(regular.readUInt16BE(0), 0xbeef);
    assert.equal(regular.readUInt16BE(6), 1);
  }
  const blocked = await lookup(gateway.port, 'TEST.google-analytics.com', 'udp');
  assert.equal(blocked[3] & 0x0f, 5);
  assert.equal(requests.length, 2);
  const alias = await lookup(gateway.port, 'alias.example', 'tcp');
  assert.equal(alias[3] & 0x0f, 5);
  assert.equal(requests.length, 3);
  approved = true;
  const allowed = await lookup(gateway.port, 'alias.example', 'udp');
  assert.equal(allowed[3] & 0x0f, 0);
  assert.equal(allowed.readUInt32BE(query('alias.example').length + 6), 0);
  assert.deepEqual(events.map(({ status, tracker }) => [status, tracker]), [
    ['forwarded', null], ['forwarded', null],
    ['blocked', 'google-analytics.com'], ['blocked', 'google-analytics.com'], ['approved', 'google-analytics.com'],
  ]);
  assert.deepEqual(errors, []);
  revokeOnUpstream = true;
  const revoked = await lookup(gateway.port, 'test.google-analytics.com', 'udp');
  assert.equal(revoked[3] & 0x0f, 5);
  assert.equal(events.at(-1).status, 'blocked');
});
