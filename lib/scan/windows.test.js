const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { filetimeToMs, permissionHistory, installedInventory, autorunInventory, privacyReadout } = require('./windows');
const { manifestName, extensionRisk } = require('./extensions');

test('converts FILETIME and decodes NonPackaged app paths and access history', () => {
  const millis = Date.UTC(2026, 10, 22);
  const start = ((BigInt(millis) + 11644473600000n) * 10000n).toString();
  assert.equal(filetimeToMs(start), millis);
  assert.equal(filetimeToMs('0'), null);
  assert.equal(filetimeToMs('bad'), null);
  assert.deepEqual(permissionHistory([{ capability: 'location', nonPackaged: true,
    key: 'C:#Program Files#Example#example.exe', permission: 'Allow', start, stop: '0' }]), [{
    capability: 'location', app: 'example.exe', exe: 'C:\\Program Files\\Example\\example.exe',
    allowed: 'Allow', lastUsedStart: millis, lastUsedStop: null, inUse: true,
  }]);
});

test('matches installed software by executable and preserves unknown size and date', () => {
  const [row] = installedInventory([{ name: 'Alternate Name', icon: '"C:\\Example\\app.exe",0', installDate: '20260231',
    source: 'HKCU' }], [{ id: 'example', name: 'Example', processNames: ['app.exe'] }]);
  assert.equal(row.researchId, 'example');
  assert.equal(row.installDate, null);
  assert.equal(row.sizeBytes, null);
});

test('flags task and service metadata without claiming a connection', () => {
  const rows = autorunInventory([
    { kind: 'task', name: 'Microsoft Compatibility Appraiser', command: 'fixture', triggers: [] },
    { kind: 'service', name: 'DiagTrack', status: 'Stopped', startType: 'Auto' },
    { kind: 'service', name: 'Printer' },
    { kind: 'startup', name: 'Calculator' },
  ]);
  assert.deepEqual(rows.map((row) => [row.name, row.flagged]), [
    ['Microsoft Compatibility Appraiser', true], ['DiagTrack', true], ['Calculator', false],
  ]);
  assert.equal(rows[1].status, 'Stopped');
});

test('reports absent settings and maps observed diagnostic policy values', () => {
  const [unknown, required] = privacyReadout([
    { setting: 'Activity history', value: null },
    { setting: 'Diagnostic data', value: 1, mode: 'diagnostic' },
  ]);
  assert.equal(unknown.value, null);
  assert.match(unknown.meaning, /No value found/);
  assert.equal(required.meaning, 'Required diagnostic data.');
});

test('resolves Chromium manifest names from locale messages', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-manifest-'));
  const locales = path.join(root, '_locales');
  const locale = path.join(locales, 'en');
  const file = path.join(locale, 'messages.json');
  await fs.mkdir(locale, { recursive: true });
  await fs.writeFile(file, '{"addonName":{"message":"Example extension"}}');
  t.after(async () => {
    await fs.unlink(file);
    await fs.rmdir(locale);
    await fs.rmdir(locales);
    await fs.rmdir(root);
  });
  assert.equal(await manifestName({ name: '__MSG_ADDONNAME__', default_locale: 'en' }, root), 'Example extension');
});

test('flags broad host access or sensitive extension permissions conservatively', () => {
  for (const permissions of [['<all_urls>'], ['*://*/*'], ['https://*/*']]) {
    assert.deepEqual(extensionRisk(permissions), { allSites: true, risky: true });
  }
  for (const permissions of [['tabs', 'webRequest'], ['cookies'], ['history']]) {
    assert.deepEqual(extensionRisk(permissions), { allSites: false, risky: true });
  }
  assert.deepEqual(extensionRisk(['tabs', 'https://example.com/*']), { allSites: false, risky: false });
});
