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
  lat: Number(process.env.HOME_LAT) || 43.0096,
  lng: Number(process.env.HOME_LNG) || -81.2737,
  label: process.env.HOME_LABEL || 'This PC',
};

const events = [];
const clients = new Set();

function pushEvent(e) {
  events.unshift(e);
  if (events.length > 200) events.pop();
  broadcast('event', e);
}

function broadcast(type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

const network = new NetworkWatcher(pushEvent);
const devices = new DeviceWatcher(pushEvent);

function state() {
  return { at: Date.now(), home: HOME, ...network.snapshot(), devices: devices.snapshot(), events: events.slice(0, 60) };
}

// Polling loops. Each waits for the previous run to finish so slow commands never pile up.
function loop(fn, everyMs) {
  const go = async () => {
    try { await fn(); } catch (err) { console.error(err); }
    setTimeout(go, everyMs);
  };
  go();
}
loop(() => network.poll(), 2000);
loop(() => devices.poll(), 1000);
setInterval(() => broadcast('state', state()), 1000);

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
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: state\ndata: ${JSON.stringify(state())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state()));
  }
  if (STATIC[url.pathname]) return sendFile(res, STATIC[url.pathname]);
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(__dirname, 'public', path.normalize(rel));
  if (!file.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end(); }
  sendFile(res, file);
});

// Only listen on this computer, so nobody else on the Wi-Fi can see your data.
server.listen(PORT, '127.0.0.1', () => console.log(`Outbound running at http://localhost:${PORT}`));
