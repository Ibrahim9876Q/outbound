// Outbound: shows which companies your apps send data to, and when apps use your mic and camera.
// Run with `npm start`, then open http://localhost:4317
const http = require('http');
const fs = require('fs');
const path = require('path');
const { NetworkWatcher } = require('./lib/network');
const { DeviceWatcher } = require('./lib/devices');
const { renderReport, renderScanAndLinks, localDate } = require('./lib/report');
const { StateStream } = require('./lib/sse');
const { StoredScan } = require('./lib/scan');
const { LinkWatcher } = require('./lib/links');
const { warnPoll } = require('./lib/poll');

const PORT = Number(process.env.PORT || 4317);
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
const stream = new StateStream(state);
let phone = null;
let sampledAt = null;

function phoneEndpoint() {
  const address = process.env.PHONE_URL || (process.env.OUTBOUND_PHONE === '1' ? 'http://127.0.0.1:4320' : '');
  const url = address && URL.parse(address);
  if (!url || url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || url.username || url.password) return null;
  url.hostname = '127.0.0.1';
  return new URL('/api/state', url);
}

async function pollPhone(endpoint) {
  try {
    const response = await fetch(endpoint, {
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
  stream.event(e);
}

const network = new NetworkWatcher(pushEvent);
const devices = new DeviceWatcher(pushEvent);
const scan = new StoredScan();
const linkWatcher = new LinkWatcher();
process.on('exit', () => {
  devices.close();
  network.foreground.close();
});
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

function state() {
  const snapshot = network.snapshot();
  return { at: Date.now(), home: HOME, ...snapshot, legacyLinks: snapshot.links,
    ...linkWatcher.snapshot(snapshot.apps), devices: devices.snapshot(), events: events.slice(0, 60), phone,
    sampledAt, fresh: sampledAt !== null };
}

// Polling loops. Each waits for the previous run to finish so slow commands never pile up.
function loop(fn, everyMs, name) {
  const go = async () => {
    try { await fn(); } catch (err) { if (!err.reported) warnPoll(name, err); }
    setTimeout(go, everyMs);
  };
  go();
}
loop(async () => {
  await network.poll();
  sampledAt = Date.now();
}, 1500, 'network');
loop(() => devices.poll(), 750, 'devices');
loop(() => {
  const { apps, links } = network.snapshot();
  return linkWatcher.poll(apps, links);
}, 15000, 'links');
const endpoint = phoneEndpoint();
if (endpoint) loop(() => pollPhone(endpoint), 2000, 'phone');
setInterval(() => stream.flush(), 500);

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

const server = http.createServer(async (req, res) => {
  if (!LOCAL_HOST.test(req.headers.host || '')) {
    res.writeHead(403);
    return res.end();
  }
  const url = URL.parse(req.url, `http://${req.headers.host}`);
  if (!url) {
    res.writeHead(400);
    return res.end();
  }
  if (url.pathname === '/events') {
    return stream.connect(res);
  }
  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(state()));
  }
  if (url.pathname === '/api/scan') {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (req.method === 'GET') {
      res.writeHead(200, headers);
      return res.end(JSON.stringify(scan.result));
    }
    if (req.method === 'POST') {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
        res.writeHead(403, headers);
        return res.end(JSON.stringify({ ok: false, startedAt: scan.result.startedAt }));
      }
      const startedAt = scan.start(state().apps.map(({ id, name }) => ({ id, name })));
      res.writeHead(startedAt ? 202 : 409, headers);
      return res.end(JSON.stringify({ ok: Boolean(startedAt), startedAt: startedAt ?? scan.result.startedAt }));
    }
    res.writeHead(405, { ...headers, Allow: 'GET, POST' });
    return res.end();
  }
  if (url.pathname === '/api/report' || url.pathname === '/api/report/download') {
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      return res.end();
    }
    const now = Date.now();
    const headers = { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' };
    if (url.pathname.endsWith('/download') || url.searchParams.get('download') === '1') {
      headers['Content-Disposition'] = `attachment; filename="outbound-${localDate(now)}.md"`;
    }
    res.writeHead(200, headers);
    const daily = renderReport(network.dailyReport.forDay(now), devices.reportSessions(now), now,
      network.seenCompanies.namesOn(localDate(now)));
    return res.end(daily + renderScanAndLinks(scan.result, [...linkWatcher.current.edges.values()]));
  }
  if (await require('./lib/blocker/routes').handle(req, res, url)) return;
  if (Object.hasOwn(STATIC, url.pathname)) return sendFile(res, STATIC[url.pathname]);
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  sendFile(res, file);
});

// Only listen on this computer, so nobody else on the Wi-Fi can see your data.
server.listen(PORT, '127.0.0.1', () => console.log(`Outbound running at http://127.0.0.1:${server.address().port}`));
