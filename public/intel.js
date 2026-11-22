(() => {
  'use strict';
  const { esc } = Outbound.util;
  const $ = (id) => document.getElementById(id);
  const number = (value) => Number.isFinite(value) ? value.toLocaleString() : 'Unavailable';
  const size = (bytes) => {
    if (!Number.isFinite(bytes)) return 'Unavailable';
    if (bytes < 1024) return bytes + ' B';
    const unit = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
    return (bytes / 1024 ** unit).toFixed(1) + ' ' + ['B', 'KiB', 'MiB', 'GiB', 'TiB'][unit];
  };
  const card = (title, body) => `<section class="card"><h2>${esc(title)}</h2>${body}</section>`;
  const list = (items, empty) => items.length ? `<ul>${items.map((item) => '<li>' + item + '</li>').join('')}</ul>` : `<p class="intel-muted">${esc(empty)}</p>`;

  async function api(url, options) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000), ...options });
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
    return response.json();
  }

  let scanPoll;
  let radarTimer;
  let radarFrame = 0;
  const scanButton = $('scan-start');
  const radar = $('scan-radar');
  const radarFrames = ['/..', './.', '../'];

  function setRadar(running) {
    radar.hidden = !running;
    if (!running) {
      clearInterval(radarTimer);
      radarTimer = null;
      return;
    }
    if (radarTimer) return;
    const draw = () => {
      const sweep = radarFrames[radarFrame++ % radarFrames.length];
      radar.textContent = '+--------+\n| ' + sweep + ' .. |\n| .. +.. |\n+--------+';
    };
    draw();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) radarTimer = setInterval(draw, 220);
  }

  function renderScan(scan) {
    const running = scan.status === 'running';
    scanButton.disabled = running;
    setRadar(running);
    const messages = { idle: 'Ready when you choose to scan.', running: 'Scanning locally', done: 'Scan complete.', error: scan.error || 'The scan failed.' };
    $('scan-status').textContent = (messages[scan.status] || 'Scan status unavailable.')
      + (running && Number.isFinite(scan.progress) ? ' / ' + Math.round(scan.progress * 100) + '%' : '');
    const browsers = (scan.browsers || []).map((browser) => card(
      [browser.browser, browser.profile].filter(Boolean).join(' / '),
      (browser.blockedReason ? `<p class="ascii-warning">${esc(browser.blockedReason)}</p>` : '')
      + '<h3>Top visited domains</h3>'
      + list((browser.sites || []).map((site) => `<strong>${esc(site.domain)}</strong> / ${number(site.visits)} visits`
        + (site.trackers?.length ? '<br>' + site.trackers.map((tracker) => esc(tracker.company)).join(', ') : '')),
      browser.historyAvailable === false ? 'History unavailable.' : 'No visited domains reported.')
      + '<h3>Tracker cookie domains</h3>'
      + list((browser.cookieDomains || []).filter((cookie) => cookie.isTracker).map((cookie) =>
        `${esc(cookie.domain)}${cookie.company ? ' / ' + esc(cookie.company) : ''} / ${number(cookie.cookies)} cookies`),
      browser.cookiesAvailable === false ? 'Cookie domain list unavailable.' : 'No tracker cookie domains reported.')));
    const trackers = scan.summary?.topTrackers || [];
    if (trackers.length) {
      const max = Math.max(1, ...trackers.map((tracker) => tracker.sites));
      browsers.push(card('Tracker companies across sites', list(trackers.map((tracker) =>
        `${esc(tracker.company)}<br><code>${'#'.repeat(Math.max(0, Math.min(20, Math.round(tracker.sites / max * 20))))}</code> ${number(tracker.sites)} sites`), '')));
    }
    if (scan.apps?.length) browsers.push(card('App data at rest', list(scan.apps.map((app) =>
      `<strong>${esc(app.app)}</strong> / ${esc(size(app.bytes))} / ${number(app.files)} files<br>`
      + Object.entries(app.kinds || {}).map(([kind, count]) => esc(kind) + ': ' + number(count)).join(' / ')), '')));
    $('scan-results').innerHTML = browsers.join('') || (scan.status === 'done' ? '<p>No stored-data results were reported.</p>' : '');
  }

  async function refreshScan() {
    clearTimeout(scanPoll);
    try {
      const scan = await api('/api/scan');
      renderScan(scan);
      if (scan.status === 'running') scanPoll = setTimeout(refreshScan, 650);
    } catch (error) {
      setRadar(false);
      scanButton.disabled = error.status === 404;
      $('scan-status').textContent = error.status === 404 ? 'Stored-data scanner is unavailable in this build.' : 'Could not read scan status.';
    }
  }

  scanButton.addEventListener('click', async () => {
    scanButton.disabled = true;
    try {
      await api('/api/scan', { method: 'POST' });
    } catch (error) {
      if (error.status !== 409) {
        $('scan-status').textContent = 'Could not start the local scan.';
        scanButton.disabled = false;
        return;
      }
    }
    refreshScan();
  });
  Outbound.onView((name) => { if (name === 'scan') refreshScan(); });
})();
