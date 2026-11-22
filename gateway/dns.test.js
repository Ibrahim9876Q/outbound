const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHandler, handleStream } = require('./dns');

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

async function lookup(handle, domain, transport) {
  const packet = query(domain);
  if (transport !== 'tcp') return handle(packet, false);
  const input = frame(packet);
  const output = [];
  await handleStream({
    async *[Symbol.asyncIterator]() { yield input.subarray(0, 1); yield input.subarray(1); },
    setTimeout() {},
    write(chunk, callback) { output.push(chunk); callback(); },
    destroy() { assert.fail('TCP fixture was destroyed before responding'); },
    end() {},
  }, handle);
  assert.equal(output.length, 1);
  assert.equal(output[0].readUInt16BE(), output[0].length - 2);
  return output[0].subarray(2);
}

test('DNS forwards ordinary names and requires approval for trackers and CNAME targets', async () => {
  const requests = [];
  let revokeOnUpstream = false;
  let approved = false;
  const events = [];
  const handle = createHandler({
    upstreams: [],
    allowTracker: async (domain) => approved && domain === 'google-analytics.com',
    onLookup: (event) => events.push(event),
    async resolve(packet, question, _upstreams, tcp) {
      requests.push({ host: question.host, tcp });
      if (revokeOnUpstream) approved = false;
      const response = answer(packet, question.host === 'alias.example' ? 'test.google-analytics.com' : null);
      return { response, answer: { ...question, flags: response.readUInt16BE(2) } };
    },
  });

  for (const transport of ['udp', 'tcp']) {
    const regular = await lookup(handle, 'regular.example', transport);
    assert.equal(regular.readUInt16BE(0), 0xbeef);
    assert.equal(regular.readUInt16BE(6), 1);
  }
  assert.deepEqual(requests.map(({ tcp }) => tcp), [false, true]);
  const blocked = await lookup(handle, 'TEST.google-analytics.com', 'udp');
  assert.equal(blocked[3] & 0x0f, 5);
  assert.equal(requests.length, 2);
  const alias = await lookup(handle, 'alias.example', 'tcp');
  assert.equal(alias[3] & 0x0f, 5);
  assert.equal(requests.length, 3);
  approved = true;
  const allowed = await lookup(handle, 'alias.example', 'udp');
  assert.equal(allowed[3] & 0x0f, 0);
  assert.equal(allowed.readUInt32BE(query('alias.example').length + 6), 0);
  assert.deepEqual(events.map(({ status, tracker }) => [status, tracker]), [
    ['forwarded', null], ['forwarded', null],
    ['blocked', 'google-analytics.com'], ['blocked', 'google-analytics.com'], ['approved', 'google-analytics.com'],
  ]);
  revokeOnUpstream = true;
  const revoked = await lookup(handle, 'test.google-analytics.com', 'udp');
  assert.equal(revoked[3] & 0x0f, 5);
  assert.equal(events.at(-1).status, 'blocked');
});
