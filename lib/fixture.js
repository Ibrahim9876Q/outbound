const fs = require('node:fs');
const path = require('node:path');
const { LIMITS } = require('./payload');

const BANNER = 'FIXTURE DATA';
const HEADER = 'X-Outbound-Mode';

function loadFixture(file) {
  if (!file?.trim()) throw new Error('Set OUTBOUND_FIXTURE to a local /api/state recording before starting replay.');
  let saved;
  try {
    const target = path.resolve(file);
    if (target.startsWith('\\\\')) throw new Error('Network paths are unavailable');
    saved = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    throw new Error('OUTBOUND_FIXTURE must point to a readable local JSON recording.');
  }
  if (!isState(saved)) throw new Error(`OUTBOUND_FIXTURE needs a fresh live /api/state recording with ${LIMITS.apps} distinct apps.`);
  return { ...saved, banner: BANNER };
}

function isState(saved) {
  return saved?.fresh === true && !saved.banner && Number.isFinite(saved.at) && Number.isFinite(saved.sampledAt) &&
    Number.isFinite(saved.home?.lat) && Number.isFinite(saved.home?.lng) &&
    Array.isArray(saved.apps) && saved.apps.length === LIMITS.apps &&
    saved.apps.every((app) => typeof app?.id === 'string' && app.id && typeof app.name === 'string' && Array.isArray(app.destinations)) &&
    new Set(saved.apps.map((app) => app.id)).size === LIMITS.apps &&
    [saved.links, saved.legacyLinks, saved.events].every(Array.isArray) &&
    [saved.devices?.mic, saved.devices?.camera].every((device) => Array.isArray(device?.apps));
}

function fixtureHtml(html) {
  return html.replace('<title>Outbound</title>', `<title>${BANNER} | Outbound</title>`)
    .replace('</head>', '<style>.boot-console{display:none}</style></head>')
    .replace('<h1>Outbound</h1>', `<h1>Outbound</h1><strong id="outbound-fixture-banner" style="color:#ffcc66">${BANNER}</strong>`);
}

function fixtureApi(req, res, url, snapshot, stream) {
  const route = url.pathname;
  if (!/^\/(?:api(?:\/|$)|auth(?:\/|$)|events$)/.test(route)) return false;
  if (req.method === 'GET' && route === '/events') {
    stream.connect(res);
    return true;
  }
  const readable = req.method === 'GET';
  const recorded = readable && route === '/api/state';
  const body = recorded ? snapshot : { banner: BANNER, error: readable ?
    'This route has no recording. Replay serves the desktop state and its event stream.' : 'Replay is read-only.' };
  res.writeHead(recorded ? 200 : readable ? 503 : 405,
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(!readable ? { Allow: 'GET' } : {}) });
  res.end(JSON.stringify(body));
  return true;
}

module.exports = { BANNER, HEADER, loadFixture, fixtureHtml, fixtureApi };
