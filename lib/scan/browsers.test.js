const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const { scanProfile } = require('./browsers');

test('a locked History database leaves cookie metadata and reports the lock', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-locked-browser-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'Network'));
  const db = new DatabaseSync(path.join(root, 'Network', 'Cookies'));
  try { db.exec("CREATE TABLE cookies (host_key TEXT); INSERT INTO cookies VALUES ('.example.test');"); }
  finally { db.close(); }
  let failedCopy;
  const result = await scanProfile({ browser: 'Chrome', profile: 'Default', root, engine: 'chromium' }, {
    copyFile: async (source, destination) => {
      if (source !== path.join(root, 'History')) return fs.copyFile(source, destination);
      failedCopy = destination;
      throw Object.assign(new Error('File is locked'), { code: 'EBUSY' });
    },
  });
  assert.match(result.blockedReason, /Could not copy History \(EBUSY\)/);
  assert.equal(result.historyAvailable, false);
  assert.equal(result.cookiesAvailable, true);
  assert.deepEqual(result.cookieDomains.map(({ domain }) => domain), ['example.test']);
  await assert.rejects(fs.stat(path.dirname(failedCopy)), { code: 'ENOENT' });
});
