const assert = require('node:assert/strict');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { aggregateHistory, registrableDomain } = require('./domains');
const { QUERIES } = require('./browsers');
const { mapTrackers } = require('./trackers');
const { scanAppData } = require('./app-data');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('aggregates history by public suffix rules and discards URL secrets', () => {
  const sites = aggregateHistory([
    { url: 'https://news.example.co.uk/private?token=secret#section', visits: 3, lastVisit: 10 },
    { url: 'https://example.co.uk/elsewhere', visits: 2, lastVisit: 30 },
    { url: 'https://another.example/visible', visits: 1, lastVisit: 12 },
    { url: 'file:///private/path', visits: 1, lastVisit: 12 },
    { url: 'http://127.0.0.1/private', visits: 5, lastVisit: 12 },
  ]);
  assert.deepEqual(sites, [
    { domain: 'example.co.uk', visits: 5, lastVisit: 30, trackers: [] },
    { domain: 'another.example', visits: 1, lastVisit: 12, trackers: [] },
  ]);
  assert.equal(registrableDomain('www.city.kawasaki.jp'), 'city.kawasaki.jp');
  assert.equal(registrableDomain('news.alice.github.io'), 'alice.github.io');
});

test('maps site trackers and cookie domains using local data without counting repeat profiles twice', () => {
  const tracker = { company: 'Example Ads', domain: 'ads.example', category: 'advertising' };
  const dataset = { sites: { 'news.example': ['ads'] }, trackers: { ads: tracker },
    domains: { 'ads.example': 'ads' }, owners: { 'news.example': 'Example News' } };
  const profiles = Array.from({ length: 2 }, () => ({
    sites: [{ domain: 'news.example' }],
    cookieDomains: [{ domain: 'a.ads.example' }, { domain: 'doubleclick.net' }, { domain: 'ordinary.example' }],
  }));
  const result = mapTrackers(profiles, dataset);
  assert.deepEqual(result, { sitesVisited: 1, sitesWithTrackers: 1, trackerCompanies: 1, cookieDomains: 3,
    trackerCookieDomains: 2, topTrackers: [{ company: 'Example Ads', sites: 1 }] });
  assert.deepEqual(profiles[0].sites[0], { domain: 'news.example', company: 'Example News', trackers: [tracker] });
  assert.equal(profiles[0].cookieDomains[0].company, 'Example Ads');
  assert.equal(profiles[0].cookieDomains[2].isTracker, false);
});

test('cookie queries project only the host and count, with no value columns', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE cookies(host_key TEXT); INSERT INTO cookies VALUES ('.example.com'), ('.example.com');");
    db.exec("CREATE TABLE moz_cookies(host TEXT); INSERT INTO moz_cookies VALUES ('example.com');");
    for (const [engine, query] of Object.entries(QUERIES)) {
      assert.match(query.cookies, /^SELECT (host_key AS host|host), COUNT\(\*\) AS cookies FROM (cookies|moz_cookies) GROUP BY (host_key|host)$/);
      assert.doesNotMatch(query.cookies, /\b(?:value|encrypted_value)\b/i);
      const [row] = db.prepare(query.cookies).all();
      assert.deepEqual(Object.keys(row), ['host', 'cookies']);
      assert.equal(row.cookies, engine === 'chromium' ? 2 : 1);
    }
  } finally {
    db.close();
  }
});

test('counts metadata for a known app and a large nested folder without duplicating parent totals', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-metadata-test-'));
  const publisher = path.join(root, 'Publisher');
  const known = path.join(publisher, 'ExampleApp');
  const large = path.join(publisher, 'OtherApp');
  await fs.mkdir(known, { recursive: true });
  await fs.mkdir(large);
  const database = path.join(known, 'test.sqlite');
  const log = path.join(large, 'test.log');
  t.after(async () => {
    await Promise.all([fs.unlink(database), fs.unlink(log)]);
    await Promise.all([fs.rmdir(known), fs.rmdir(large)]);
    await fs.rmdir(publisher);
    await fs.rmdir(root);
  });
  await fs.writeFile(database, Buffer.alloc(12));
  const file = await fs.open(log, 'w');
  await file.truncate(51 * 1024 * 1024);
  await file.close();
  const { apps } = await scanAppData([{ id: 'exampleapp.exe', name: 'Example App' }], () => {}, { LOCALAPPDATA: root });
  assert.deepEqual(apps.map((app) => [app.app, app.files, app.bytes]), [['OtherApp', 1, 51 * 1024 * 1024], ['Example App', 1, 12]]);
  assert.equal(apps[0].kinds.logs, 1);
  assert.equal(apps[1].kinds.databases, 1);
});
