const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DailyHistory, cutoff } = require('./history');
const { localDate } = require('./report');

test('rolls over at the local calendar boundary, retains 30 days and preserves daily unions across restart', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-history-'));
  const file = path.join(dir, 'history.json');
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); });
  const now = Date.now();
  const noon = new Date(now).setHours(12, 0, 0, 0);
  const oldest = cutoff(noon);
  const earlier = new Date(noon);
  earlier.setDate(earlier.getDate() - 30);
  await fs.writeFile(file, JSON.stringify({ days: { [oldest]: {}, [localDate(earlier.getTime())]: {} } }));
  const history = new DailyHistory(file);
  const sample = (org, milliseconds) => new Map([['demo.exe', {
    name: 'Demo', companies: new Set([org]), countries: new Set(['CA']),
    trackers: new Map([['ads', new Set([org])]]), background: { milliseconds },
  }]]);
  const midnight = new Date(now).setHours(0, 0, 0, 0);
  const sessions = { mic: [{ id: 'demo.exe', app: 'Demo', start: midnight - 5000, stop: midnight + 10000 }], camera: [] };
  history.capture(noon, sample('A', 60000), sessions);
  history.save();
  const restarted = new DailyHistory(file);
  restarted.capture(noon, sample('B', 30000), { mic: [], camera: [] });
  assert.deepEqual(restarted.snapshot(noon).days.at(-1).apps[0], {
    id: 'demo.exe', name: 'Demo', companies: 2, countries: 1, trackers: 2, backgroundMinutes: 1.5, micSeconds: 10, cameraSeconds: 0,
  });
  const tomorrow = new Date(noon);
  tomorrow.setDate(tomorrow.getDate() + 1);
  restarted.capture(tomorrow.getTime(), sample('C', 0), { mic: [], camera: [] });
  assert.deepEqual(restarted.snapshot(tomorrow.getTime()).days.map((d) => d.date), [localDate(noon), localDate(tomorrow.getTime())]);
});
