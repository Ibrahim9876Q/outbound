const { timeInUse } = require('./devices');

const CATEGORIES = ['ads', 'analytics', 'data broker', 'uncategorized'];

function summary(name) {
  return {
    name, companies: new Set(), countries: new Set(),
    trackers: new Map(CATEGORIES.map((category) => [category, new Set()])),
    background: backgroundSummary(),
  };
}

function backgroundSummary() {
  return { connections: 0, companies: new Set(), trackers: new Set() };
}

function localDate(now) {
  const date = new Date(now);
  return new Date(now - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

class DailyNetworkReport {
  forDay(now) {
    const day = localDate(now);
    if (this.day !== day) {
      this.day = day;
      this.apps = new Map();
    }
    return this.apps;
  }

  observe(apps, id, name, destination) {
    if (!apps.has(id)) apps.set(id, summary(name));
    const app = apps.get(id);
    app.name = name;
    if (destination.org && destination.org !== 'Unknown owner') app.companies.add(destination.org);
    if (destination.country) app.countries.add(destination.country);
    if (destination.tracker) {
      const category = destination.trackerCategory ?? 'uncategorized';
      const label = destination.org === 'Unknown owner' ? destination.host : destination.org;
      app.trackers.get(category).add(label || 'Unknown tracker');
    }
  }
}

function appKey(name) {
  return name.trim().toLowerCase().replace(/\.exe$/, '');
}

function safe(value) {
  return String(value).replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~]/g, '\\$&');
}

function list(values) {
  return [...values].sort().map(safe).join(', ') || 'None observed';
}

function duration(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function renderReport(networkApps, deviceSessions, now = Date.now(), newCompanies = []) {
  const start = new Date(now).setHours(0, 0, 0, 0);
  const rows = new Map([...networkApps].map(([id, app]) => [id, { ...app, mic: [], camera: [] }]));
  const aliases = new Map();
  for (const [id, app] of rows) {
    aliases.set(appKey(app.name), id);
    aliases.set(appKey(id), id);
  }

  for (const kind of ['mic', 'camera']) {
    for (const session of deviceSessions[kind]) {
      if (session.stop <= start || session.start > now) continue;
      const key = appKey(session.id || session.app);
      const id = aliases.get(key) ?? aliases.get(appKey(session.app)) ?? key;
      if (!rows.has(id)) rows.set(id, { ...summary(session.app), mic: [], camera: [] });
      rows.get(id)[kind].push(session);
    }
  }

  const totals = summary('Totals');
  const lines = [`# Outbound report for ${localDate(now)}`, '',
    'Network totals cover observations since Outbound started today. Device time combines overlapping use.', ''];
  const detail = [];
  const backgroundApps = [];
  for (const app of [...rows.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    for (const company of app.companies) totals.companies.add(company);
    for (const country of app.countries) totals.countries.add(country);
    detail.push(`## ${safe(app.name)}`, '', `- Companies (${app.companies.size}): ${list(app.companies)}`,
      `- Countries (${app.countries.size}): ${list(app.countries)}`);
    for (const [category, trackers] of app.trackers) {
      for (const tracker of trackers) totals.trackers.get(category).add(tracker);
      detail.push(`- Trackers — ${category} (${trackers.size}): ${list(trackers)}`);
    }
    detail.push(`- Microphone: ${duration(timeInUse(app.mic, start, now))}`,
      `- Camera: ${duration(timeInUse(app.camera, start, now))}`, '');
    if (app.background.connections) {
      const { connections, companies, trackers } = app.background;
      backgroundApps.push(`- ${safe(app.name)} — ${connections} connections; companies: ${list(companies)}; trackers: ${list(trackers)}`);
    }
  }
  lines.push('## Totals', '', `- Apps: ${rows.size}`, `- Companies: ${totals.companies.size}`,
    `- Countries: ${totals.countries.size}`,
    `- Tracker organizations: ${new Set([...totals.trackers.values()].flatMap((set) => [...set])).size}`,
    ...[...totals.trackers].map(([category, trackers]) => `- Trackers — ${category}: ${trackers.size}`),
    `- Microphone: ${duration(timeInUse(deviceSessions.mic, start, now))}`,
    `- Camera: ${duration(timeInUse(deviceSessions.camera, start, now))}`, '',
    '## Talked in the background', '',
    ...(backgroundApps.length ? backgroundApps : ['None observed']), '',
    '## New companies today', '',
    `- Companies (${newCompanies.length}): ${list(newCompanies)}`, '',
    ...detail);
  return lines.join('\n');
}

function renderScanAndLinks(scan, links) {
  const lines = ['', '## Stored on this PC', ''];
  if (scan.status !== 'done') {
    lines.push(scan.status === 'running' ? 'The opt-in scan is running.' : 'No completed opt-in scan is available.', '');
  } else {
    lines.push(`- App data measured: ${scan.summary.appDataBytes} bytes across ${scan.apps.length} folders`);
    if (scan.appDataTimedOut) lines.push('- App-folder totals are partial because the scan reached its time limit.');
    for (const app of scan.apps) {
      lines.push(`- ${safe(app.app)} at ${safe(app.path)} — ${app.bytes} bytes, ${app.files} files`);
    }
    for (const browser of scan.browsers) {
      const history = browser.historyAvailable ? `${browser.sites.length} history domains` : 'history unavailable';
      const cookies = browser.cookiesAvailable ? `${browser.cookieDomains.length} cookie domains` : 'cookies unavailable';
      lines.push(`- ${safe(browser.browser)} / ${safe(browser.profile)} — ${history}, ${cookies}`);
      if (browser.blockedReason) lines.push(`  - ${safe(browser.blockedReason)}`);
    }
    lines.push('');
  }
  lines.push('## Sites that track you', '');
  if (scan.status === 'done') {
    const { sitesVisited, sitesWithTrackers, trackerCompanies, trackerCookieDomains, topTrackers } = scan.summary;
    lines.push(`Public data lists trackers for ${sitesWithTrackers} of ${sitesVisited} visited domains, across ${trackerCompanies} companies. The cookie metadata matched ${trackerCookieDomains} tracker domains.`,
      'These public associations describe prior measurements of those sites. A local visit may load different trackers.', '');
    for (const tracker of topTrackers) lines.push(`- ${safe(tracker.company)} — ${tracker.sites} visited sites`);
  } else {
    lines.push('Run the opt-in scan to compare visited domains with public tracker data.');
  }
  lines.push('', '## Apps talking to each other', '');
  if (!links.length) lines.push('No links in the latest sample.');
  for (const link of links) {
    lines.push(`- ${safe(link.from)} → ${safe(link.to)} — ${safe(link.kind)} (${safe(link.confidence)}). ${safe(link.evidence)}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { DailyNetworkReport, renderReport, renderScanAndLinks, localDate, backgroundSummary };
