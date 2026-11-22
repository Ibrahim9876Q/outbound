const assert = require('node:assert/strict');
const test = require('node:test');
const { gunzipSync } = require('node:zlib');
const { sendScan } = require('./scan-response');

test('serves unchanged scan JSON over gzip and honors an explicit opt-out', async () => {
  const result = { status: 'done', browsers: Array.from({ length: 1000 }, () => ({ sites: ['example.test'] })) };
  async function request(header) {
    const response = {
      writeHead(status, headers) { this.status = status; this.headers = headers; },
      end(body) { this.body = body; },
    };
    await sendScan({ headers: { 'accept-encoding': header } }, response, result);
    return response;
  }
  const packed = await request('br, gzip');
  const plain = await request('*;q=1, gzip;q=0');
  assert.equal(packed.headers['Content-Encoding'], 'gzip');
  assert.equal(packed.headers['Cache-Control'], 'no-store');
  assert.equal(packed.headers.Vary, 'Accept-Encoding');
  assert.equal(plain.headers['Content-Encoding'], undefined);
  assert.deepEqual(gunzipSync(packed.body), plain.body);
  assert.deepEqual(JSON.parse(plain.body), result);
});
