const dgram = require('node:dgram');
const net = require('node:net');
const { randomInt } = require('node:crypto');
const { isTracker, orgForHost } = require('../lib/orgs');

const HEADER = 12;
const MAX_IN_FLIGHT = 64;
const TYPE = { CNAME: 5, DNAME: 39, OPT: 41, SVCB: 64, HTTPS: 65 };
const RCODE = { OK: 0, FORMERR: 1, SERVFAIL: 2, REFUSED: 5 };

function readName(packet, start, compressed = true) {
  const labels = [];
  let offset = start;
  let end;
  let size = 1;
  let jumps = 0;
  for (;;) {
    const length = packet.readUInt8(offset);
    if (length === 0) return { host: labels.join('.'), end: end ?? offset + 1 };
    if ((length & 0xc0) === 0xc0) {
      const pointer = packet.readUInt16BE(offset) & 0x3fff;
      if (!compressed || pointer < HEADER || pointer >= offset || ++jumps > 32) {
        throw new Error('Invalid DNS name pointer');
      }
      end ??= offset + 2;
      offset = pointer;
      continue;
    }
    size += length + 1;
    if (length > 63 || size > 255 || offset + length >= packet.length) {
      throw new Error('Invalid DNS label');
    }
    const label = packet.toString('latin1', offset + 1, offset + 1 + length);
    labels.push(label.replace(/[^a-z0-9_-]/gi, (byte) => '\\' + byte.charCodeAt(0).toString(10).padStart(3, '0')).toLowerCase());
    offset += length + 1;
  }
}

function readQuestion(packet, response = false) {
  const flags = packet.readUInt16BE(2);
  if (Boolean(flags & 0x8000) !== response || (flags & 0x7800) || packet.readUInt16BE(4) !== 1) {
    throw new Error('Unsupported DNS message');
  }
  const { host, end } = readName(packet, HEADER, response);
  const type = packet.readUInt16BE(end);
  const klass = packet.readUInt16BE(end + 2);
  if (klass !== 1 || type === 251 || type === 252) throw new Error('Unsupported DNS question');
  return { host, type, end: end + 4, flags, id: packet.readUInt16BE(0) };
}

function visitRecords(packet, offset, visit) {
  for (let section = 0; section < 3; section++) {
    const count = packet.readUInt16BE(6 + section * 2);
    for (let index = 0; index < count; index++) {
      const { host, end } = readName(packet, offset);
      const type = packet.readUInt16BE(end);
      const klass = packet.readUInt16BE(end + 2);
      const start = end + 10;
      offset = start + packet.readUInt16BE(end + 8);
      if (offset > packet.length) throw new Error('Truncated DNS record');
      visit({ host, type, klass, start, end: offset, ttl: end + 4, section });
    }
  }
  if (offset !== packet.length) throw new Error('Unexpected DNS message length');
}

function trackerDomain(host) {
  if (!isTracker(host)) return null;
  let domain = host;
  while (domain.includes('.')) {
    const parent = domain.slice(domain.indexOf('.') + 1);
    if (!isTracker(parent)) break;
    domain = parent;
  }
  return domain;
}

function inspectAnswer(packet, question) {
  const trackers = new Set();
  const ttlOffsets = [];
  const add = (host) => {
    const tracker = trackerDomain(host);
    if (tracker) trackers.add(tracker);
  };
  visitRecords(packet, question.end, (record) => {
    if (record.type === TYPE.OPT) return;
    ttlOffsets.push(record.ttl);
    if (record.klass !== 1 || record.section === 1) return;
    add(record.host);
    const cname = record.type === TYPE.CNAME || record.type === TYPE.DNAME;
    const service = record.type === TYPE.SVCB || record.type === TYPE.HTTPS;
    if (!cname && !service) return;
    const { host, end } = readName(packet, record.start + (service ? 2 : 0), !service);
    if (end > record.end || (cname && end !== record.end)) throw new Error('Invalid DNS alias');
    add(host);
  });
  return { trackers, ttlOffsets };
}

function reply(packet, question, rcode, truncated = false) {
  const result = Buffer.alloc(question?.end ?? HEADER);
  result.writeUInt16BE(packet.readUInt16BE(0), 0);
  result.writeUInt16BE(0x8080 | (packet.readUInt16BE(2) & 0x0110) | (truncated ? 0x0200 : 0) | rcode, 2);
  if (question) {
    result.writeUInt16BE(1, 4);
    packet.copy(result, HEADER, HEADER, question.end);
  }
  return result;
}

function frame(packet) {
  const result = Buffer.allocUnsafe(packet.length + 2);
  result.writeUInt16BE(packet.length);
  packet.copy(result, 2);
  return result;
}

function exchangeUdp(upstream, packet) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket(net.isIPv6(upstream.host) ? 'udp6' : 'udp4');
    const timer = setTimeout(() => finish(new Error('Upstream DNS timed out')), 1300);
    function finish(error, response) {
      clearTimeout(timer);
      socket.removeAllListeners('message');
      try { socket.close(); } catch { /* already closed */ }
      if (error) reject(error);
      else resolve(response);
    }
    socket.once('error', finish);
    socket.on('message', (response) => {
      if (response.length >= HEADER && response.readUInt16BE(0) === packet.readUInt16BE(0)) {
        finish(null, response);
      }
    });
    socket.connect(upstream.port, upstream.host, () => socket.send(packet, (error) => {
      if (error) finish(error);
    }));
  });
}

function exchangeTcp(upstream, packet) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(upstream, () => socket.write(frame(packet)));
    const timer = setTimeout(() => finish(new Error('Upstream DNS timed out')), 1800);
    let buffer = Buffer.alloc(0);
    function finish(error, response) {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(response);
    }
    socket.once('error', finish);
    socket.once('end', () => finish(new Error('Incomplete upstream DNS response')));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 2) return;
      const length = buffer.readUInt16BE(0);
      if (buffer.length >= length + 2) finish(null, buffer.subarray(2, length + 2));
    });
  });
}

async function forward(packet, question, upstreams, tcp) {
  const request = Buffer.from(packet);
  request.writeUInt16BE(randomInt(0x10000));
  for (const upstream of upstreams) {
    try {
      let response = await (tcp ? exchangeTcp : exchangeUdp)(upstream, request);
      if (!tcp && (response.readUInt16BE(2) & 0x0200)) response = await exchangeTcp(upstream, request);
      const answer = readQuestion(response, true);
      if (answer.id !== request.readUInt16BE(0) || answer.host !== question.host ||
          answer.type !== question.type || (answer.flags & 0x0200)) {
        throw new Error('Mismatched DNS response');
      }
      response.writeUInt16BE(question.id);
      return { response, answer };
    } catch {
      // Try the next configured resolver.
    }
  }
  throw new Error('Upstream DNS unavailable');
}

function createHandler({ upstreams, allowTracker, onLookup, resolve = forward }) {
  let inFlight = 0;
  return async function handle(packet, tcp) {
    if (packet.length < HEADER || (packet[2] & 0x80)) return null;
    let question;
    let udpSize = 512;
    try {
      question = readQuestion(packet);
      visitRecords(packet, question.end, ({ type, klass, section }) => {
        if (section !== 2 || type !== TYPE.OPT) throw new Error('Unsupported DNS query record');
        udpSize = Math.min(1232, Math.max(512, klass));
      });
    } catch {
      return reply(packet, question, RCODE.FORMERR);
    }
    if (inFlight >= MAX_IN_FLIGHT) return reply(packet, question, RCODE.SERVFAIL);
    const { host, type } = question;
    const log = (status, tracker = null) => onLookup({ host: host || '.', type, status, tracker, org: orgForHost(tracker || host) });
    const direct = trackerDomain(host);
    let checkedTracker = direct;
    inFlight++;
    try {
      if (direct && !await allowTracker(direct)) {
        log('blocked', direct);
        return reply(packet, question, RCODE.REFUSED);
      }
      const { response, answer } = await resolve(packet, question, upstreams, tcp);
      const { trackers, ttlOffsets } = inspectAnswer(response, answer);
      if (trackers.size > 8) throw new Error('Too many tracker names in DNS response');
      // Approval may have expired or been revoked while the upstream resolver answered.
      if (direct) trackers.add(direct);
      for (const tracker of trackers) {
        checkedTracker ||= tracker;
        if (!await allowTracker(tracker)) {
          log('blocked', tracker);
          return reply(packet, question, RCODE.REFUSED);
        }
      }
      if (checkedTracker) {
        for (const offset of ttlOffsets) response.writeUInt32BE(0, offset);
      }
      log(answer.flags & 0x000f ? 'unresolved' : checkedTracker ? 'approved' : 'forwarded', checkedTracker);
      return !tcp && response.length > udpSize ? reply(packet, question, RCODE.OK, true) : response;
    } catch {
      log('error', checkedTracker);
      return reply(packet, question, RCODE.SERVFAIL);
    } finally {
      inFlight--;
    }
  };
}

async function handleStream(socket, handle) {
  socket.setTimeout(15000, () => socket.destroy());
  let buffer = Buffer.alloc(0);
  try {
    for await (const chunk of socket) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2 && !socket.destroyed) {
        const size = buffer.readUInt16BE(0);
        if (size < HEADER) return socket.destroy();
        if (buffer.length < size + 2) break;
        const packet = buffer.subarray(2, size + 2);
        buffer = buffer.subarray(size + 2);
        const response = await handle(packet, true);
        if (response && !socket.destroyed) {
          await new Promise((resolve, reject) => socket.write(frame(response), (error) => error ? reject(error) : resolve()));
        }
      }
    }
  } catch {
    socket.destroy();
  } finally {
    socket.end();
  }
}

function listen(server, bind) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    bind(() => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function startDns({ host, port, client, onError, ...options }) {
  const handle = createHandler(options);
  const udp = dgram.createSocket('udp4');
  const sockets = new Set();
  const tcp = net.createServer({ allowHalfOpen: true }, (socket) => {
    if (socket.remoteAddress !== client) return socket.destroy();
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    void handleStream(socket, handle);
  });
  tcp.maxConnections = 16;
  let open = true;
  function close() {
    if (!open) return;
    open = false;
    try { udp.close(); } catch { /* failed to bind */ }
    tcp.close();
    for (const socket of sockets) socket.destroy();
  }
  udp.on('message', async (packet, peer) => {
    if (peer.address !== client) return;
    const response = await handle(packet, false);
    if (open && response) udp.send(response, peer.port, peer.address, () => {});
  });
  try {
    await listen(udp, (done) => udp.bind({ port, address: host, exclusive: true }, done));
    port = udp.address().port;
    udp.on('error', onError);
    await listen(tcp, (done) => tcp.listen({ port, host, exclusive: true }, done));
    tcp.on('error', onError);
  } catch (error) {
    close();
    throw error;
  }
  return { port, close };
}

module.exports = { startDns, trackerDomain, createHandler, handleStream };
