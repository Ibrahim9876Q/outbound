// Outbound: shows which companies your apps send data to, and when apps use your mic and camera.
// Run with `npm start`, then open http://localhost:4317
const http = require('http');
const fs = require('fs');
const path = require('path');
const { NetworkWatcher } = require('./lib/network');
const { DeviceWatcher } = require('./lib/devices');

const PORT = Number(process.env.PORT) || 4317;
// Where arcs on the globe start. Defaults to Western University, London ON. No IP lookup service is called.
const HOME = {
  lat: coordinate(process.env.HOME_LAT, 90, 43.0096),
  lng: coordinate(process.env.HOME_LNG, 180, -81.2737),
  label: process.env.HOME_LABEL || 'This PC',
};

function coordinate(value, limit, fallback) {
  const number = value?.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : fallback;
}

const events = [];
const clients = new Set();
const pendingEvents = [];
let phone = null;

async function pollPhone() {
  try {
    const response = await fetch('http://127.0.0.1:4320/api/state', {
      signal: AbortSignal.timeout(1000),
      redirect: 'error',
    });
    if (!response.ok) { phone = null; return; }
    const { stats, lookups, consent } = await response.json();
    const counts = [stats?.lookups, stats?.blocked, consent?.active];
    if (!counts.every((count) => Number.isSafeInteger(count) && count >= 0) || !Array.isArray(lookups)) {
      phone = null;
      return;
    }
    phone = {
      online: true,
      lookups: stats.lookups,
      blocked: stats.blocked,
      approvals: consent.active,
      lastTracker: lookups.find((lookup) => typeof lookup?.tracker === 'string' && lookup.tracker)?.tracker ?? null,
    };
  } catch {
    phone = null;
  }
}

function pushEvent(e) {
  events.unshift(e);
  if (events.length > 200) events.pop();
  if (clients.size) {
    pendingEvents.push(e);
    if (pendingEvents.length > 200) pendingEvents.shift();
  }
}

function frame(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

const network = new NetworkWatcher(pushEvent);
const devices = new DeviceWatcher(pushEvent);
process.on('exit', () => devices.close());
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

function state() {
  return { at: Date.now(), home: HOME, ...network.snapshot(), devices: devices.snapshot(), events: events.slice(0, 60), phone };
}

function broadcastState() {
  const events = pendingEvents.splice(0);
  if (!clients.size) return;
  const batch = events.map((event) => frame('event', event)).join('') + frame('state', state());
  for (const res of clients) if (!res.writableNeedDrain) res.write(batch);
}

// Polling loops. Each waits for the previous run to finish so slow commands never pile up.
function loop(fn, everyMs) {
  const go = async () => {
    try { await fn(); } catch (err) { console.error(err); }
    setTimeout(go, everyMs);
  };
  go();
}
loop(() => network.poll(), 1500);
loop(() => devices.poll(), 750);
setInterval(pollPhone, 2000);
pollPhone();
setInterval(broadcastState, 500);

const PUBLIC = path.join(__dirname, 'public');
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const STATIC = {
  '/vendor/globe.gl.min.js': path.join(__dirname, 'node_modules', 'globe.gl', 'dist', 'globe.gl.min.js'),
  '/vendor/earth-night.jpg': path.join(__dirname, 'node_modules', 'three-globe', 'example', 'img', 'earth-night.jpg'),
  '/vendor/earth-topology.png': path.join(__dirname, 'node_modules', 'three-globe', 'example', 'img', 'earth-topology.png'),
  '/vendor/night-sky.png': path.join(__dirname, 'node_modules', 'three-globe', 'example', 'img', 'night-sky.png'),
};

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  if (!LOCAL_HOST.test(req.headers.host || '')) {
    res.writeHead(403);
    return res.end();
  }
  const url = URL.parse(req.url, 'http://localhost');
  if (!url) {
    res.writeHead(400);
    return res.end();
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.flushHeaders();
    clients.add(res);
    res.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(state()));
  }
  if (Object.hasOwn(STATIC, url.pathname)) return sendFile(res, STATIC[url.pathname]);
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  sendFile(res, file);
});

// Only listen on this computer, so nobody else on the Wi-Fi can see your data.
server.listen(PORT, '127.0.0.1', () => console.log(`Outbound running at http://localhost:${PORT}`));
