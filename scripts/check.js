const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

async function check() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const stopped = once(child, 'close').catch(() => {});
  const timeout = AbortSignal.timeout(12000);
  try {
    const base = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        output += chunk;
        const match = output.match(/Outbound running at (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) resolve(match[1]);
      });
      child.once('error', reject);
      child.once('close', (code) => reject(new Error(`Server exited with code ${code}`)));
      timeout.addEventListener('abort', () => reject(timeout.reason), { once: true });
    });
    async function get(route) {
      const result = await fetch(new URL(route, base), { signal: timeout, redirect: 'error' });
      assert.equal(result.status, 200, `GET ${route}`);
      return result;
    }
    const html = await (await get('/')).text();
    // Navigation links and embedded data URLs are independent of desktop assets.
    const assets = new Set([...html.matchAll(/<(?:script|link|img|source|video|audio)\b[^>]*?\s(?:src|href)=["']([^"']+)["']/gi)]
      .map((match) => new URL(match[1], base))
      .filter((url) => url.origin === base)
      .map((url) => url.pathname + url.search));
    assert(assets.size > 0, 'No desktop assets found');
    for (const asset of assets) assert((await (await get(asset)).arrayBuffer()).byteLength > 0, asset);
    const state = await (await get('/api/state')).json();
    assert(Array.isArray(state.apps) && state.devices);
    assert.match(await (await get('/api/report')).text(), /^# Outbound report for /);
    const reader = (await get('/events')).body.getReader();
    try {
      const decoder = new TextDecoder();
      let first = '';
      while (!first.includes('\n\n')) {
        const { done, value } = await reader.read();
        assert(!done, 'SSE closed before the first message');
        first += decoder.decode(value, { stream: true });
      }
      const frame = first.split('\n\n', 1)[0];
      assert.match(frame, /^event: state\ndata: /);
      assert(Array.isArray(JSON.parse(frame.split('\ndata: ')[1]).apps));
    } finally {
      await reader.cancel();
    }
    console.log(`Smoke check passed for ${assets.size} assets, state, report and SSE.`);
  } finally {
    child.kill();
    await stopped;
  }
}

check().catch((error) => { console.error(error); process.exitCode = 1; });
