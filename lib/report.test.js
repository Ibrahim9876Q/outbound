const assert = require('node:assert/strict');
const test = require('node:test');
const { DailyNetworkReport, renderReport, renderScanAndLinks } = require('./report');

test('reports daily observations, unique totals, and clipped overlapping device time', () => {
  const midnight = new Date(2026, 10, 22).getTime();
  const now = midnight + 20_000;
  const report = new DailyNetworkReport();
  const apps = report.forDay(now);
  const tracker = { org: 'Example Ads', country: 'US', tracker: true, trackerCategory: 'ads' };
  report.observe(apps, 'chrome.exe', 'Google Chrome', tracker);
  report.observe(apps, 'chrome.exe', 'Google Chrome', tracker);
  report.observe(apps, 'edge.exe', 'Edge <Preview>', tracker);
  report.observe(apps, 'edge.exe', 'Edge <Preview>', { org: 'Example Analytics', country: 'CA', tracker: true, trackerCategory: 'analytics' });
  apps.get('chrome.exe').background.connections = 2;
  apps.get('chrome.exe').background.companies.add('Example Ads');
  const body = renderReport(apps, {
    mic: [
      { app: 'Chrome', start: midnight - 5_000, stop: midnight + 10_000 },
      { app: 'Recorder', start: midnight + 5_000, stop: now },
    ],
    camera: [{ id: 'edge.exe', app: 'Edge', start: midnight + 12_000, stop: now }],
  }, now, ['Example Ads']);

  assert.match(body, /Outbound report for 2026-11-22/);
  assert.match(body, /Apps: 3\n- Companies: 2\n- Countries: 2\n- Tracker organizations: 2/);
  assert.match(body, /Trackers — ads: 1\n- Trackers — analytics: 1/);
  assert.match(body, /Microphone: 0m 20s\n- Camera: 0m 8s/);
  assert.match(body, /## Google Chrome[\s\S]*?Microphone: 0m 10s/);
  assert.match(body, /## Edge &lt;Preview&gt;/);
  assert.match(body, /## Recorder/);
  assert.match(body, /## Talked in the background\n\n- Google Chrome — 2 connections/);
  assert.match(body, /## New companies today\n\n- Companies \(1\): Example Ads/);
  assert.equal(report.forDay(new Date(2026, 10, 23).getTime()).size, 0);
});

test('renders an empty report without inventing observations', () => {
  const body = renderReport(new Map(), { mic: [], camera: [] });
  assert.match(body, /Apps: 0\n- Companies: 0\n- Countries: 0/);
});

test('shows matched visited domains in the opt-in report and labels inferred links', () => {
  const scan = { status: 'done', apps: [], browsers: [{
    browser: 'Firefox', profile: 'Default', historyAvailable: true, cookiesAvailable: false,
    sites: [{ domain: 'example.test', trackers: [{ company: 'Example Ads' }] }], cookieDomains: [],
  }], summary: { appDataBytes: 0, sitesVisited: 1, sitesWithTrackers: 1, trackerCompanies: 1,
    trackerCookieDomains: 0, topTrackers: [{ company: 'Example Ads', sites: 1 }] } };
  const report = renderScanAndLinks(scan, [{ from: 'Firefox', to: 'Firefox', kind: 'pipe',
    confidence: 'inferred', evidence: 'Name only' }]);
  assert.match(report, /## Stored on this PC/);
  assert.match(report, /## Sites that track you[\s\S]*example\\\.test — Example Ads/);
  assert.match(report, /## Apps talking to each other[\s\S]*pipe \(inferred\)/);
});
