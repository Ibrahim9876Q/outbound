const assert = require('node:assert/strict');
const test = require('node:test');
const { DailyNetworkReport, renderReport } = require('./report');

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
  const body = renderReport(apps, {
    mic: [
      { app: 'Chrome', start: midnight - 5_000, stop: midnight + 10_000 },
      { app: 'Recorder', start: midnight + 5_000, stop: now },
    ],
    camera: [{ id: 'edge.exe', app: 'Edge', start: midnight + 12_000, stop: now }],
  }, now);

  assert.match(body, /Outbound report for 2026-11-22/);
  assert.match(body, /Apps: 3\n- Companies: 2\n- Countries: 2\n- Tracker organizations: 2/);
  assert.match(body, /Trackers — ads: 1\n- Trackers — analytics: 1/);
  assert.match(body, /Microphone: 0m 20s\n- Camera: 0m 8s/);
  assert.match(body, /## Google Chrome[\s\S]*?Microphone: 0m 10s/);
  assert.match(body, /## Edge &lt;Preview&gt;/);
  assert.match(body, /## Recorder/);
  assert.equal(report.forDay(new Date(2026, 10, 23).getTime()).size, 0);
});

test('renders an empty report without inventing observations', () => {
  const body = renderReport(new Map(), { mic: [], camera: [] });
  assert.match(body, /Apps: 0\n- Companies: 0\n- Countries: 0/);
});
