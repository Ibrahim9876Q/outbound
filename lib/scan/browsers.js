const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { aggregateHistory, hostname } = require('./domains');

const QUERIES = {
  chromium: {
    history: 'SELECT url, visit_count AS visits, CAST(last_visit_time / 1000 AS INTEGER) - 11644473600000 AS lastVisit FROM urls',
    cookies: 'SELECT host_key AS host, COUNT(*) AS cookies FROM cookies GROUP BY host_key',
  },
  firefox: {
    history: 'SELECT url, visit_count AS visits, CAST(last_visit_date / 1000 AS INTEGER) AS lastVisit FROM moz_places',
    cookies: 'SELECT host, COUNT(*) AS cookies FROM moz_cookies GROUP BY host',
  },
};

async function directories(root) {
  try { return (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()); }
  catch { return []; }
}

async function profiles(env = process.env) {
  const found = [];
  const roots = [];
  if (env.LOCALAPPDATA) {
    for (const [browser, relative] of [['Chrome', 'Google/Chrome'], ['Edge', 'Microsoft/Edge'], ['Brave', 'BraveSoftware/Brave-Browser']]) {
      roots.push({ browser, root: path.join(env.LOCALAPPDATA, relative, 'User Data') });
    }
  }
  if (env.APPDATA) {
    const root = path.join(env.APPDATA, 'Opera Software');
    for (const entry of await directories(root)) {
      if (/^Opera (Stable|GX Stable|Beta|Developer)$/i.test(entry.name)) {
        roots.push({ browser: 'Opera', root: path.join(root, entry.name), rootProfile: entry.name });
      }
    }
    const firefox = path.join(env.APPDATA, 'Mozilla', 'Firefox', 'Profiles');
    for (const entry of await directories(firefox)) {
      found.push({ browser: 'Firefox', profile: entry.name, root: path.join(firefox, entry.name), engine: 'firefox' });
    }
  }
  for (const { browser, root, rootProfile } of roots) {
    if (rootProfile) found.push({ browser, profile: rootProfile, root, engine: 'chromium' });
    for (const entry of await directories(root)) {
      if (!/^(Default|Profile \d+|Guest Profile)$/i.test(entry.name)) continue;
      found.push({ browser, profile: rootProfile ? `${rootProfile} / ${entry.name}` : entry.name,
        root: path.join(root, entry.name), engine: 'chromium' });
    }
  }
  return found;
}

async function readCopy(source, query, aggregate, copyFile) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-scan-'));
  const destination = path.join(temp, 'browser.sqlite');
  try {
    await copyFile(source, destination);
    try { await copyFile(source + '-wal', destination + '-wal'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const db = new DatabaseSync(destination, { readOnly: true });
    try { return aggregate(db.prepare(query).iterate()); }
    finally { db.close(); }
  } finally {
    await fs.rm(temp, { recursive: true, force: true, maxRetries: 3 });
  }
}

function aggregateCookies(rows) {
  const counts = new Map();
  for (const row of rows) {
    const domain = typeof row.host === 'string' && hostname(row.host);
    if (domain) counts.set(domain, (counts.get(domain) ?? 0) + row.cookies);
  }
  return [...counts].map(([domain, cookies]) => ({ domain, cookies, isTracker: false }))
    .sort((a, b) => b.cookies - a.cookies || a.domain.localeCompare(b.domain));
}

async function scanProfile({ browser, profile, root, engine }, { copyFile = fs.copyFile } = {}) {
  const result = { browser, profile, historyAvailable: false, cookiesAvailable: false, sites: [], cookieDomains: [] };
  const queries = QUERIES[engine];
  const history = engine === 'firefox' ? 'places.sqlite' : 'History';
  const cookies = engine === 'firefox' ? 'cookies.sqlite' : path.join('Network', 'Cookies');
  const blocked = [];
  async function read(available, file, field, query, aggregate) {
    try {
      result[field] = await readCopy(path.join(root, file), query, aggregate, copyFile);
      result[available] = true;
    } catch (error) {
      if (error.code === 'ENOENT') return;
      if (['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) {
        blocked.push(`Could not copy ${file} (${error.code}). Close ${browser} and retry if it is locked.`);
      } else {
        blocked.push(`Could not read ${file} (${error.code || error.name}).`);
      }
    }
  }
  await read('historyAvailable', history, 'sites', queries.history, aggregateHistory);
  await read('cookiesAvailable', cookies, 'cookieDomains', queries.cookies, aggregateCookies);
  if (blocked.length) result.blockedReason = blocked.join(' ');
  return result;
}

module.exports = { QUERIES, profiles, scanProfile };
