const { gzip } = require('node:zlib');
const { promisify } = require('node:util');

const compress = promisify(gzip);
const representations = new WeakMap();

function acceptsGzip(header = '') {
  const codings = new Map(header.split(',').map((item) => {
    const [name, ...parameters] = item.trim().toLowerCase().split(';');
    const quality = parameters.find((part) => part.trim().startsWith('q='));
    return [name.trim(), quality ? Number(quality.trim().slice(2)) : 1];
  }));
  return (codings.get('gzip') ?? codings.get('*') ?? 0) > 0;
}

async function sendScan(req, res, result) {
  let entry = representations.get(result);
  if (!entry) {
    entry = { json: Buffer.from(JSON.stringify(result)) };
    representations.set(result, entry);
  }
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Accept-Encoding',
  };
  let body = entry.json;
  if (body.length >= 16384 && acceptsGzip(req.headers['accept-encoding'])) {
    entry.gzip ??= compress(entry.json).catch(() => null);
    const packed = await entry.gzip;
    if (packed && packed.length < body.length) {
      body = packed;
      headers['Content-Encoding'] = 'gzip';
    }
  }
  if (res.destroyed) return;
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

module.exports = { sendScan };
