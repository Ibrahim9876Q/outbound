const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateScore, scoreApps } = require('./score');

test('scores only observed weights and explains every factor including unknown inputs', () => {
  const score = calculateScore({ trackerCompanies: 4, countries: 0 });
  assert.equal(score.value, 38);
  assert.equal(score.coverage, 40);
  assert.equal(score.factors.length, 7);
  assert.deepEqual(score.factors[0], { factor: 'trackerCompanies', weight: 30, raw: 4, points: 15,
    reason: 'Distinct tracker companies attributed to recent endpoints: 4 (full weight at 8).' });
  assert.equal(score.factors[1].raw, 0);
  const missing = score.factors.find((factor) => factor.factor === 'riskyExtensions');
  assert.equal(missing.raw, null);
  assert.match(missing.reason, /unknown from the available data/);
  assert.equal(calculateScore({}).value, null);
});

test('derives distinct counts from scan observations and keeps non-browser extension counts unknown', () => {
  const apps = [{ id: 'chrome.exe', name: 'Google Chrome', destinations: [
    { org: 'Ads', tracker: true, country: 'CA' }, { org: 'Ads', tracker: true, country: 'CA' },
  ], background: { connections: 3 } }, { id: 'test-player.exe', name: 'Test Player', destinations: [] }];
  const scan = { status: 'done', permissions: [{ capability: 'microphone', app: 'chrome.exe', lastUsedStart: 1 }],
    extensions: [{ browser: 'Chrome', id: 'one', risky: true }, { browser: 'Chrome', id: 'one', risky: true }],
    autoruns: [{ name: 'Example task', command: '"C:\\Chrome\\chrome.exe" --startup' }] };
  const { apps: rows, overall } = scoreApps(apps, scan, 100);
  const raw = (score, name) => score.factors.find(({ factor }) => factor === name).raw;
  assert.equal(raw(rows[0].score, 'trackerCompanies'), 1);
  assert.equal(raw(rows[0].score, 'countries'), 1);
  assert.equal(raw(rows[0].score, 'sensitivePermissions'), 1);
  assert.equal(raw(rows[0].score, 'riskyExtensions'), 1);
  assert.equal(raw(rows[0].score, 'autoruns'), 1);
  assert.equal(raw(rows[1].score, 'riskyExtensions'), null);
  assert.match(overall.factors[0].reason, /Per-app observed mean/);
});
