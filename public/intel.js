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
  const dossierLink = (name, kind = 'company', label = name) => name
    ? `<button type="button" class="intel-link" data-dossier="${esc(name)}" data-dossier-kind="${kind}">${esc(label)}</button>` : '';

  async function api(url, options) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000), ...options });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw Object.assign(new Error(detail?.error || 'HTTP ' + response.status), {
        status: response.status, retryAfter: response.headers.get('Retry-After'),
      });
    }
    return response.json();
  }

  let scanPoll;
  let radarTimer;
  let radarFrame = 0;
  const scanButton = $('scan-start');
  const radar = $('scan-radar');
  const radarFrames = ['/..', './.', '../'];
  let lastScan;
  let selectedProfile;
  let showEmptyProfiles = false;

  function trackerChips(trackers) {
    const companies = new Map();
    for (const tracker of trackers) {
      if (!tracker.company) continue;
      const key = tracker.company.trim().toLowerCase();
      const company = companies.get(key) || { name: tracker.company, entries: new Map() };
      company.entries.set(JSON.stringify([tracker.domain, tracker.category]), tracker);
      companies.set(key, company);
    }
    return [...companies.values()].map(({ name, entries }) =>
      `<details class="tracker-chip"><summary>${esc(name)}${entries.size > 1 ? ' x' + entries.size : ''}</summary>`
      + dossierLink(name) + list([...entries.values()].map(({ domain, category }) =>
        esc([domain, category].filter(Boolean).join(' / '))), 'No tracker domains reported.') + '</details>').join('');
  }

  function profileCard(browser) {
    const cookieDomains = browser.cookieDomains || [];
    const otherCookies = cookieDomains.filter((cookie) => !cookie.isTracker);
    const cookieRow = (cookie) =>
      `${esc(cookie.domain)}${cookie.company ? ' / ' + esc(cookie.company) : ''} / ${number(cookie.cookies)} cookies ${researchBadge(cookie.researchId)}`;
    return card([browser.browser, browser.profile].filter(Boolean).join(' / '),
      (browser.blockedReason ? `<p class="ascii-warning">${esc(browser.blockedReason)}</p>` : '')
      + '<h3>Top visited domains</h3>'
      + list((browser.sites || []).map((site) => `<strong>${esc(site.domain)}</strong> / ${number(site.visits)} visits`
        + '<div class="tracker-chips">' + trackerChips(site.trackers || []) + '</div>'
        + (researchBadge(site.researchId) || dossierLink(site.company || site.domain, site.company ? 'company' : 'domain'))),
      browser.historyAvailable === false ? 'History unavailable.' : 'No visited domains reported.')
      + '<h3>Tracker cookie domains</h3>'
      + list(cookieDomains.filter((cookie) => cookie.isTracker).map(cookieRow),
        browser.cookiesAvailable === false ? 'Cookie domain list unavailable.' : 'No tracker cookie domains reported.')
      + (otherCookies.length ? `<details><summary>Other cookie domains (${otherCookies.length})</summary>${list(otherCookies.map(cookieRow), '')}</details>` : ''));
  }

  function scanSummary(summary) {
    const trackers = summary.topTrackers || [];
    const max = Math.max(1, ...trackers.map((tracker) => tracker.sites));
    const verdict = Number.isFinite(summary.sitesWithTrackers) && Number.isFinite(summary.sitesVisited)
      ? `Previously observed tracker associations matched ${summary.sitesWithTrackers} of ${summary.sitesVisited} visited domains.`
      : 'No scan totals were reported.';
    return card('Scan summary', '<strong>' + esc(verdict) + '</strong>'
      + `<p>${number(summary.sitesVisited)} sites visited / ${number(summary.sitesWithTrackers)} with trackers / ${number(summary.trackerCookieDomains)} tracker cookie domains / ${size(summary.appDataBytes)} app data</p>`
      + '<p class="intel-muted">Matches come from a public tracker dataset. The scan observes locally stored domains.</p>'
      + '<h3>Top tracker companies across sites</h3>' + list(trackers.map((tracker) =>
        dossierLink(tracker.company) + `<br><code>${'#'.repeat(Math.max(0, Math.min(20, Math.round(tracker.sites / max * 20))))}</code> ${number(tracker.sites)} sites`),
      'No tracker companies were reported across visited sites.'));
  }

  function renderProfiles(browsers) {
    const profiles = browsers.map((browser, index) => ({
      browser, index, visits: (browser.sites || []).reduce((sum, site) => sum + (site.visits || 0), 0),
      empty: !(browser.sites?.length || browser.cookieDomains?.length || browser.blockedReason),
    })).sort((a, b) => b.visits - a.visits || a.index - b.index);
    const empty = profiles.filter((profile) => profile.empty).length;
    const shown = profiles.filter((profile) => showEmptyProfiles || !profile.empty);
    const selected = shown.find((profile) => profile.index === selectedProfile) || shown[0];
    return card('Browser profiles',
      (empty ? `<button type="button" class="tool-btn" data-empty-profiles aria-pressed="${showEmptyProfiles}">${showEmptyProfiles ? 'Hide' : 'Show'} ${empty} empty ${empty === 1 ? 'profile' : 'profiles'}</button>` : '')
      + (shown.length ? '<div class="intel-filters profile-tabs" role="tablist" aria-label="Browser profiles">'
        + shown.map(({ browser, index, visits }) => `<button type="button" class="tool-btn" role="tab" aria-selected="${index === selected.index}" data-scan-profile="${index}">${esc([browser.browser, browser.profile].filter(Boolean).join(' / '))} / ${visits} visits</button>`).join('') + '</div>' : '')
      + (selected ? profileCard(selected.browser) : '<p>No browser profiles with results are shown.</p>'));
  }

  function scanWindows(scan, prefix) {
    const report = (key, title, render, empty) => scan.status === 'running' && !scan[key]?.length ? '' : card(title,
      Array.isArray(scan[key]) ? render(scan[key]) || `<p class="intel-muted">${esc(empty)}</p>`
        : '<p class="intel-muted">This scan section is unavailable.</p>');
    const timestamp = (value) => Number.isFinite(value) ? new Date(value).toLocaleString() : 'Time unavailable';
    const permissions = report('permissions', 'Permission history', (rows) => {
      const groups = new Map();
      for (const row of rows) {
        const key = String(row.capability).toLowerCase();
        const group = groups.get(key) || [];
        group.push(row);
        groups.set(key, group);
      }
      const day = 86400000;
      const now = scan.finishedAt || Date.now();
      const priority = ['location', 'microphone', 'webcam', 'contacts', 'phonecallhistory', 'phonecall', 'email', 'chat'];
      const labels = { webcam: 'Camera', microphone: 'Microphone', location: 'Location', contacts: 'Contacts',
        phonecallhistory: 'Phone call history', phonecall: 'Phone calls', email: 'Email', chat: 'Chat',
        graphicscapturewithoutborder: 'Screen capture without border', graphicscaptureprogrammatic: 'Screen capture',
        passkeysenumeration: 'Passkey list', systemaimodels: 'On-device AI models', useraccountinformation: 'Account info',
        broadfilesystemaccess: 'Broad file access', documentslibrary: 'Documents library', pictureslibrary: 'Pictures library',
        videoslibrary: 'Videos library', appointments: 'Calendar', radios: 'Wireless radios', gazeinput: 'Eye tracking',
        humaninterface: 'Human interface devices', activity: 'Motion and activity', bluetoothsync: 'Bluetooth sync',
        bluetooth: 'Bluetooth', cellulardata: 'Cellular data', musiclibrary: 'Music library', notificationlistener: 'Notifications' };
      const renderCapability = ([capability, group]) => `<h3>${esc(labels[capability] || group[0].capability.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))}</h3><p class="intel-muted">Last 7 days / oldest to newest</p>`
        + list(group.map((row) => {
          const age = Number.isFinite(row.lastUsedStart) ? Math.floor((now - row.lastUsedStart) / day) : -1;
          const timeline = age >= 0 && age < 7 ? Array.from({ length: 7 }, (_, i) => i === 6 - age ? '#' : '.').join('') : '.......';
          const stopped = Number.isFinite(row.lastUsedStop) && row.lastUsedStop > 0;
          return `<code>[${timeline}]</code> ${esc(row.app)} ${researchBadge(row.researchId)}<br>`
            + esc(Number.isFinite(row.lastUsedStart) && row.lastUsedStart > 0
              ? stopped ? timestamp(row.lastUsedStart) + ' to ' + timestamp(row.lastUsedStop)
                : 'last started ' + timestamp(row.lastUsedStart) + ', stop time not recorded'
              : 'No use timestamp reported');
        }), '');
      const sensitive = priority.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)]);
      const other = [...groups].filter(([key]) => !priority.includes(key)).sort(([a], [b]) =>
        (labels[a] || a).localeCompare(labels[b] || b));
      return '<p>' + dossierLink('tim-hortons', 'app', 'Tim Hortons dossier') + '</p>'
        + sensitive.map(renderCapability).join('') + (other.length ? `<details class="permission-other">
        <summary>Other permissions (${other.length})</summary>${other.map(renderCapability).join('')}</details>` : '');
    }, 'No permission history was reported.');
    const installed = report('installed', 'Installed software', (rows) => rows.length ? list(rows.map((row) => {
      return `<strong>${esc(row.name)}</strong> ${researchBadge(row.researchId)}`
        + '<br>' + esc([row.publisher, row.version, row.installDate, Number.isFinite(row.sizeBytes) ? size(row.sizeBytes) : null].filter(Boolean).join(' / '));
    }), '') : '', 'No installed software entries were reported.');
    const autoruns = report('autoruns', 'Starts or runs on its own (may send data)', (rows) =>
      '<p class="intel-muted">Flags are based on startup, task, and service metadata rather than observed traffic.</p>'
      + list(rows.filter((row) => row.flagged).map((row) =>
        `<strong class="ascii-warning">${esc(row.name)}</strong> / ${esc(row.kind)}<br>`
          + esc([row.stale && 'Previous observation', row.publisher, row.status, row.startType, row.reason].filter(Boolean).join(' / '))),
      'No startup entries were flagged by this scan.'), 'No startup information was reported.');
    const extensions = report('extensions', 'Extensions allowed to read every site', (rows) =>
      '<p class="intel-muted">This list reflects the declared scope of extension permissions.</p>' + list(rows.filter((row) => row.allSites).map((row) =>
      `<strong class="ascii-warning">${esc(row.name)}</strong> / ${esc([row.browser, row.profile, row.version].filter(Boolean).join(' / '))} ${researchBadge(row.researchId)}<br>`
      + esc((row.permissions || []).join(', '))), 'No extension with all-site access was reported.'), 'No extension inventory was reported.');
    const privacy = report('windowsPrivacy', 'Windows privacy checklist', (rows) => rows.length ? list(rows.map((row) =>
      `<strong>[ ] ${esc(row.setting)}</strong><br>Current: ${esc(row.value ?? 'Unavailable')}${row.meaning ? ' / ' + esc(row.meaning) : ''}`
        + (row.recommended ? '<br>Recommended: ' + esc(row.recommended) : '')), '') : '', 'No Windows privacy values were reported.');
    return [permissions && `<div id="${prefix}-permissions">${permissions}</div>`, installed, autoruns, extensions, privacy];
  }

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

  let permissionJump = false;
  let completedScan;
  function renderScan(scan) {
    lastScan = scan;
    const running = scan.status === 'running';
    scanButton.disabled = running || Boolean(scan.appDataBackground);
    setRadar(running);
    const folderCount = new Set((scan.apps || []).map((app) => app.path).filter(Boolean)).size;
    const done = scan.appDataBackground
      ? 'Scan complete, app-data walk still running (' + number(folderCount) + ' folders reported so far)'
      : 'Scan complete.';
    const messages = { idle: 'Ready when you choose to scan.', running: 'Scanning locally', done, error: scan.error || 'The scan failed.' };
    const status = (messages[scan.status] || 'Scan status unavailable.')
      + (running && Number.isFinite(scan.progress) ? ' / ' + Math.round(scan.progress * 100) + '%' : '');
    if ($('scan-status').textContent !== status) $('scan-status').textContent = status;
    if (scan.status === 'done' && !scan.appDataBackground) completedScan = scan;
    const previous = scan.previous ?? (scan.status === 'running' ? completedScan : null);
    $('scan-previous').hidden = !previous;
    if (previous) {
      $('scan-previous-label').textContent = 'Previous scan, ' + new Date(previous.finishedAt).toLocaleString();
      renderScanResults(previous, 'scan-previous');
    }
    renderScanResults(scan, 'scan');
    const permissions = $('scan-permissions') || (previous && $('scan-previous-permissions'));
    if (permissionJump && permissions && Outbound.view === 'scan') {
      permissionJump = false;
      permissions.scrollIntoView({ block: 'start' });
    }
  }

  function renderScanResults(scan, prefix) {
    const browsers = [];
    if (scan.status === 'done' && scan.summary) browsers.push(scanSummary(scan.summary));
    if (scan.browsers?.length) browsers.push(renderProfiles(scan.browsers));
    if (scan.apps?.length) browsers.push(card('App data at rest', list(scan.apps.map((app) =>
      `<strong>${dossierLink(app.app, 'app')}</strong> / ${esc(size(app.bytes))} / ${number(app.files)} files${app.partial ? ' / partial' : ''}<br>`
      + Object.entries(app.kinds || {}).map(([kind, count]) => esc(kind) + ': ' + number(count)).join(' / ')), '')));
    if (scan.status === 'done' || scan.status === 'running') {
      if (scan.warnings?.length) browsers.push(card('Scan warnings', list(scan.warnings.map(esc), '')));
      browsers.push(...scanWindows(scan, prefix));
    }
    const html = browsers.join('') || (scan.status === 'done' ? '<p>No stored-data results were reported.</p>' : '');
    const output = $(prefix + '-results');
    if (output.dataset.model === html) return;
    const viewport = $('view-scan');
    const viewportTop = viewport.getBoundingClientRect().top;
    const oldCards = [...output.children];
    const cardKey = (node) => node.id || node.querySelector('h2')?.textContent || node.tagName;
    const anchor = oldCards.find((node) => node.getBoundingClientRect().bottom > viewportTop);
    const anchorTop = anchor?.getBoundingClientRect().top;
    const template = document.createElement('template');
    template.innerHTML = html;
    const oldByKey = new Map(oldCards.map((node) => [cardKey(node), node]));
    const nextCards = [...template.content.children].map((node) => {
      const old = oldByKey.get(cardKey(node));
      // A user-opened disclosure is UI state, so ignore it in the content comparison.
      const source = node.outerHTML;
      if (old?.scanSource === source) return old;
      node.scanSource = source;
      return node;
    });
    for (let index = 0; index < nextCards.length; index++) {
      if (output.children[index] !== nextCards[index]) output.insertBefore(nextCards[index], output.children[index] ?? null);
    }
    while (output.children.length > nextCards.length) output.lastElementChild.remove();
    output.dataset.model = html;
    const nextAnchor = anchor && nextCards.find((node) => cardKey(node) === cardKey(anchor));
    if (nextAnchor) viewport.scrollTop += nextAnchor.getBoundingClientRect().top - anchorTop;
  }

  $('view-scan').addEventListener('click', (event) => {
    const profile = event.target.closest('[data-scan-profile]');
    const toggle = event.target.closest('[data-empty-profiles]');
    if (!lastScan || (!profile && !toggle)) return;
    const grid = event.target.closest('.intel-grid');
    if (profile) selectedProfile = Number(profile.dataset.scanProfile);
    if (toggle) showEmptyProfiles = !showEmptyProfiles;
    renderScan(lastScan);
    const target = profile ? `[data-scan-profile="${selectedProfile}"]` : '[data-empty-profiles]';
    grid?.querySelector(target)?.focus();
  });

  let scanRequest = 0;
  let hasScanStatus = true;
  async function refreshScan(backgroundOnly = false) {
    clearTimeout(scanPoll);
    const request = ++scanRequest;
    try {
      if (backgroundOnly && hasScanStatus) {
        try {
          const status = await api('/api/scan/status');
          if (request !== scanRequest) return;
          if (status.appDataBackground) {
            scanPoll = setTimeout(() => refreshScan(true), 3000);
            return;
          }
        } catch (error) {
          if (error.status !== 404) throw error;
          hasScanStatus = false;
        }
      }
      const scan = await api('/api/scan');
      if (request !== scanRequest) return;
      renderScan(scan);
      if (scan.status === 'running') scanPoll = setTimeout(refreshScan, 650);
      else if (scan.appDataBackground) scanPoll = setTimeout(() => refreshScan(true), 3000);
    } catch (error) {
      if (request !== scanRequest) return;
      setRadar(false);
      scanButton.disabled = error.status === 404;
      $('scan-status').textContent = error.status === 404 ? 'Stored-data scanner is unavailable in this build.' : 'Could not read scan status.';
      if (error.status !== 404 && (Outbound.view === 'scan' || backgroundOnly)) {
        scanPoll = setTimeout(() => refreshScan(backgroundOnly), backgroundOnly ? 3000 : 1500);
      }
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
  $('permission-jump').addEventListener('click', () => Outbound.showView('scan', 'permissions'));
  Outbound.onView((name) => {
    if (name !== 'scan') return;
    permissionJump = Outbound.viewTarget === 'permissions';
    if (lastScan) renderScan(lastScan);
    refreshScan();
    loadResearch();
  });

  let research;
  let researchLoading;
  let selection;
  const lower = (value) => String(value ?? '').trim().toLowerCase();
  const entries = (record, key) => (record[key] || []).filter((item) => item.source?.verified === true);
  const fields = ['declared', 'sharesWith', 'destinations', 'incidents'];
  let researchIndex = new Map();

  function researchBadge(id) {
    if (!id) return '';
    const company = id.startsWith('company:');
    const count = Outbound.researchIncidents(id);
    return dossierLink(company ? id.slice(8) : id, company ? 'company' : 'app',
      'DOSSIER' + (count === null ? '' : ' [' + count + ']'));
  }
  Outbound.researchBadge = researchBadge;
  Outbound.researchIncidents = (id) => {
    const record = researchIndex.get(id);
    return record ? entries(record, 'incidents').length : null;
  };

  function sourceHTML(source) {
    let url;
    try {
      const parsed = new URL(source.url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href;
    } catch { /* Invalid citations stay plain text. */ }
    const details = [source.publisher || 'Publisher unavailable', source.date || 'Date unavailable'].join(' / ');
    return `<small class="citation">${esc(details)}${url ? ` / <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.title || 'Source')}</a>` : ''}</small>`;
  }

  function renderDossier() {
    const records = research || [];
    const search = lower($('dossier-search').value);
    const kind = $('dossier-kind').value;
    const visible = records.filter((record) => [record.name, record.publisher, record.id, ...(record.match || [])]
      .some((value) => lower(value).includes(search)) && (!kind || entries(record, 'incidents').some((incident) => incident.kind === kind)));
    $('dossier-list').innerHTML = '<h2>Research index</h2>' + list(visible.map((record) => dossierLink(record.name, record.type)),
      research ? 'No researched entries match.' : 'Research is unavailable in this build.');
    const target = selection?.[1];
    const selected = selection && records.find((record) => (selection[0] === 'domain' || record.type === selection[0])
      && [record.name, record.id, ...record.match].some((value) => lower(value) === lower(target)));
    const output = $('dossier-card');
    if (!selected) {
      output.textContent = target ? 'No verified dossier for ' + target + '.' : 'Choose a researched app or company.';
      return;
    }
    const display = (key, heading, row) => `<h3>${heading}</h3>` + list(entries(selected, key)
      .filter((entry) => key !== 'incidents' || !kind || entry.kind === kind)
      .map((entry) => row(entry) + sourceHTML(entry.source)), 'No verified entries reported.');
    const observed = (Outbound.state?.apps || []).find((app) => app.researchId === selected.id && app.id?.endsWith('.exe'))
      || (Outbound.state?.apps || []).find((app) => app.id?.endsWith('.exe') && app.destinations?.length);
    output.innerHTML = `<h2>${esc(selected.name)}</h2>`
      + (selected.publisher ? `<p>${esc(selected.publisher)}</p>` : '')
      + (observed ? `<p>Observed app / ${esc(observed.name)} ${blockButton('app', observed.id)}</p>` : '')
      + blockButton(selected.type, selected.type === 'app' ? selected.processNames?.[0] : selected.name)
      + (selected.domains || []).map((domain) => blockButton('domain', domain)).join(' ')
      + display('declared', 'Declared collection', (entry) => `<strong>${esc(entry.data)}</strong> / ${esc(entry.purpose)}`)
      + display('sharesWith', 'Declared sharing', (entry) => `<strong>${esc(entry.party)}</strong> / ${esc(entry.purpose)}`)
      + display('destinations', 'Declared destinations', (entry) => `<strong>${esc(entry.country)}</strong> / ${esc(entry.note)}`)
      + display('incidents', 'Documented incidents', (entry) => `<strong>${esc(entry.title)}</strong><br>`
        + esc([entry.kind, entry.year, entry.jurisdiction, entry.amount].filter(Boolean).join(' / ')) + '<br>' + esc(entry.summary));
  }

  async function loadResearch() {
    if (research) { renderDossier(); return; }
    if (researchLoading) return;
    researchLoading = true;
    try {
      const data = await api('/data/research.json');
      research = [
        ...(data.apps || []).map((record) => ({ ...record, type: 'app', match: [...(record.processNames || []), ...(record.domains || [])] })),
        ...(data.companies || []).map((record) => ({ ...record, type: 'company', match: record.aliases || [] })),
      ];
      researchIndex = new Map(research.map((record) => [record.type === 'company' ? 'company:' + record.name : record.id, record]));
      const incidents = research.reduce((sum, record) => sum + entries(record, 'incidents').length, 0);
      const sources = new Set(research.flatMap((record) => fields.flatMap((key) => entries(record, key).map((item) => item.source.url).filter(Boolean))));
      $('dossier-count').textContent = (data.apps || []).length + ' apps / ' + incidents + ' incidents / ' + sources.size + ' sources';
    } catch {
      $('dossier-count').textContent = 'Verified research is unavailable in this build.';
    } finally {
      researchLoading = false;
      if (Outbound.view === 'dossier') renderDossier();
      if (Outbound.view === 'scan' && lastScan) renderScan(lastScan);
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-dossier]');
    if (!trigger) return;
    const { dossierKind, dossier } = trigger.dataset;
    Outbound.showView('dossier', dossierKind === 'app' ? dossier : dossierKind + ':' + dossier);
  });
  $('dossier-search').addEventListener('input', renderDossier);
  $('dossier-kind').addEventListener('change', renderDossier);
  Outbound.onView((name) => {
    if (name !== 'dossier') return;
    const id = Outbound.viewTarget;
    const match = /^(company|domain):(.*)$/.exec(id);
    selection = id ? (match ? match.slice(1) : ['app', id]) : null;
    if (id) $('dossier-search').value = '';
    loadResearch();
  });
  let researchScheduled = false;
  Outbound.onState(() => {
    if (researchScheduled) return;
    researchScheduled = true;
    if (window.requestIdleCallback) requestIdleCallback(loadResearch, { timeout: 2000 });
    else setTimeout(loadResearch, 300);
  });

  let policy;
  let dashboardAuth;
  let authLoaded = false;
  const authNeedsSignIn = () => dashboardAuth?.enabled && !dashboardAuth.user;
  const authorName = (id) => id
    ? dashboardAuth?.user?.sub === id ? dashboardAuth.user.name || id : id
    : 'Local session';

  async function refreshAuth() {
    const control = $('auth-control');
    try {
      dashboardAuth = await api('/auth/me');
      const { enabled, configured, user, error } = dashboardAuth;
      control.replaceChildren();
      control.removeAttribute('title');
      if (!enabled) {
        control.textContent = 'LOCAL MODE';
        control.title = 'Set AUTH0_LOGIN=1 and configure the dashboard credentials. See Auth0 setup in Rules.';
      } else if (!configured) {
        control.textContent = error || 'Auth0 setup incomplete';
      } else {
        const link = document.createElement('a');
        link.href = user ? '/auth/logout' : '/auth/login';
        link.textContent = user ? 'Sign out' : 'Sign in with Auth0';
        if (user) {
          const name = document.createElement('span');
          name.textContent = user.name || user.sub;
          name.title = name.textContent;
          control.append(name, ' ');
        }
        control.append(link);
      }
    } catch {
      control.textContent = 'Auth status unavailable';
    } finally {
      authLoaded = true;
      control.hidden = false;
      if (Outbound.view === 'rules') {
        renderPolicy();
        resumeApproval();
      }
    }
  }
  let blockTarget;
  let policyBusy = false;
  let previewRetry = false;
  let previewedApp;
  let approvalWatch;
  let approvalTimer;
  $('rules-globe').addEventListener('click', () => Outbound.showAppOnGlobe(previewedApp));

  function blockButton(kind, value) {
    return value ? `<button type="button" class="tool-btn" data-block-kind="${esc(kind)}" data-block-value="${esc(value)}">Block ${esc(kind)}${kind === 'domain' ? ' / ' + esc(value) : ''}</button>` : '';
  }
  Outbound.blockButton = blockButton;

  function renderAuthFlow() {
    const identity = !authLoaded ? 'Checking dashboard sign-in'
      : !dashboardAuth ? 'Sign-in status unavailable'
        : !dashboardAuth.enabled ? 'Local mode'
          : !dashboardAuth.configured ? 'Sign-in setup incomplete'
            : dashboardAuth.user ? 'Signed in with Auth0' : 'Auth0 sign-in configured';
    const configured = policy?.auth0Configured ?? policy?.providerConfigured;
    const providerState = configured == null ? 'Configuration unavailable'
      : configured ? 'Configured' : 'Setup required';
    $('auth-flow-identity').textContent = identity;
    $('auth-flow-push').textContent = providerState;
    $('auth-flow-fga').textContent = providerState;
    $('auth-flow-plan').textContent = policy?.enforcer === 'dry-run' ? 'Dry-run configured'
      : policy?.enforcer ? policy.enforcer + ' configured' : 'Enforcer unavailable';
  }

  function renderPolicy() {
    renderAuthFlow();
    const pending = $('rules-pending');
    if (blockTarget) {
      const label = policyBusy ? 'Preparing dry-run preview…' : previewRetry ? 'Retry preview' : 'Preview block';
      pending.innerHTML = `<p>Target: ${esc(blockTarget.kind)} / ${esc(blockTarget.value)}</p><button type="button" class="tool-btn" id="rules-confirm">${label}</button>`;
      pending.setAttribute('aria-busy', String(policyBusy));
      const submit = $('rules-confirm');
      submit.disabled = policyBusy || !authLoaded || authNeedsSignIn() || !policy || policy.enforcer !== 'dry-run';
      submit.addEventListener('click', submitBlock);
    } else {
      pending.replaceChildren();
      pending.removeAttribute('aria-busy');
    }
    if (!policy) {
      $('rules-list').textContent = 'No local policy data available.';
      return;
    }
    const auth0 = policy.auth0Configured ?? policy.providerConfigured;
    $('rules-provider').textContent = 'Decision provider: ' + policy.provider
      + ' / Auth0: ' + (auth0 == null ? 'configuration not reported' : auth0 ? 'configured' : 'not configured')
      + ' / enforcer: ' + policy.enforcer;
    $('rules-list').innerHTML = '<h2>Rules list</h2>' + list((policy.rules || []).map((rule) =>
      `${esc(rule.action)} / ${esc(rule.target.kind)} / ${esc(rule.target.value)} <small>Created by ${esc(authorName(rule.createdBy))} / ${esc(rule.approval?.status || 'unavailable')}</small>
        ${canWatch(rule) ? `<button type="button" class="tool-btn" data-watch-rule="${esc(rule.id)}">Show approval</button>` : ''}
        <button type="button" class="tool-btn" data-remove-rule="${esc(rule.id)}" ${policyBusy || !authLoaded || authNeedsSignIn() || policy.enforcer !== 'dry-run' ? 'disabled' : ''}>Remove</button>`), 'No rules saved.');
  }

  function canWatch(rule) {
    return authLoaded && !authNeedsSignIn() && rule.approval?.status === 'pending'
      && rule.approval.requestId && (!dashboardAuth?.enabled || rule.createdBy === dashboardAuth.user?.sub);
  }

  function approvalPanel(label, binding, detail = '') {
    const panel = $('phone-approval');
    panel.hidden = false;
    panel.textContent = ['+-- ' + label + ' --+', binding, detail].filter(Boolean).join('\n');
  }

  function watchApproval(response) {
    clearTimeout(approvalTimer);
    const watch = { id: response.requestId, binding: response.bindingMessage };
    approvalWatch = watch;
    $('rules-plan').hidden = true;
    $('rules-status').textContent = '';
    approvalPanel('WAITING FOR PHONE APPROVAL', watch.binding, 'Match this reference to the phone push.');
    scheduleApproval(watch, response.retryAfterMs);
  }

  function scheduleApproval(watch, delay = 1000) {
    approvalTimer = setTimeout(() => pollApproval(watch), Math.max(250, delay));
  }

  async function pollApproval(watch) {
    try {
      const result = await api('/api/policy/requests/' + encodeURIComponent(watch.id), { signal: AbortSignal.timeout(30000) });
      if (approvalWatch !== watch) return;
      if (result.status === 'pending') {
        scheduleApproval(watch, result.retryAfterMs);
        return;
      }
      const expired = result.status === 'expired' || /\bexpired\b/i.test(result.error || '');
      const approved = result.status === 'approved';
      const label = approved ? 'PHONE APPROVAL GRANTED' : expired ? 'PHONE APPROVAL EXPIRED' : 'PHONE APPROVAL DENIED';
      approvalPanel(label, result.bindingMessage || watch.binding,
        approved ? 'FGA relation written. See the local dry-run plan below.' : result.error || 'The request was denied.');
      if (approved) showPlan(result.plan, result.decision);
      refreshPolicy();
    } catch (error) {
      if (approvalWatch !== watch) return;
      if (error.status === 401 || error.status === 404) {
        approvalPanel('PHONE APPROVAL UNAVAILABLE', watch.binding, error.status === 401
          ? 'Sign in with Auth0 to resume this approval.' : 'The approval request is unavailable. Check the Rules list.');
        if (error.status === 401) refreshAuth();
        return;
      }
      approvalPanel('WAITING FOR PHONE APPROVAL', watch.binding, 'Could not check the request. Trying again…');
      const seconds = Number(error.retryAfter);
      scheduleApproval(watch, Math.max(5000, Number.isFinite(seconds) ? seconds * 1000 : 0));
    }
  }

  function resumeApproval() {
    if (approvalWatch) return;
    const saved = policy?.rules?.find(canWatch);
    if (saved) watchApproval(saved.approval);
  }

  function showPlan(plan, decision) {
    const output = $('rules-plan');
    if (plan?.some((entry) => entry.applied)) {
      output.textContent = 'The backend reported an applied command. Review the local policy configuration.';
      output.hidden = false;
      return;
    }
    const commands = (plan || []).map((entry) => [entry.command, entry.reason && '# ' + entry.reason].filter(Boolean).join('\n')).filter(Boolean);
    output.textContent = '+-- DRY RUN, nothing applied --+\n'
      + (decision ? 'Decision: ' + decision.status + ' / via ' + decision.via + '\n' : '')
      + (commands.join('\n\n') || 'No commands returned.');
    output.hidden = false;
  }

  async function refreshPolicy() {
    try {
      policy = await api('/api/policy');
      if (policy.enforcer !== 'dry-run') $('rules-status').textContent = 'Preview controls require the dry-run enforcer.';
    } catch {
      policy = null;
      $('rules-provider').textContent = 'Policy API unavailable in this build.';
    }
    renderPolicy();
    resumeApproval();
  }

  async function submitBlock() {
    if (policyBusy || !authLoaded || authNeedsSignIn() || !blockTarget || policy?.enforcer !== 'dry-run') return;
    policyBusy = true;
    previewRetry = false;
    $('rules-status').textContent = 'Preparing the local dry-run preview…';
    renderPolicy();
    try {
      const target = { ...blockTarget };
      if (target.kind === 'company') {
        const addresses = [...new Set((Outbound.state?.apps || []).flatMap((app) => app.destinations)
          .filter((destination) => lower(destination.org) === lower(target.value))
          .map((destination) => destination.ip)
          .filter((ip) => typeof ip === 'string' && /^[a-f0-9:.]+$/i.test(ip)))].slice(0, 100);
        if (addresses.length) target.addresses = addresses;
      }
      const response = await api('/api/policy/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ target, action: 'block', scope: 'session' }),
      });
      previewedApp = target.kind === 'app' ? target.value : null;
      $('rules-globe').hidden = !previewedApp;
      if (response.status === 'pending' && response.requestId) {
        watchApproval(response);
      } else {
        showPlan(response.plan, response.decision);
        $('rules-status').textContent = response.status === 'denied' ? response.error || 'Policy request denied.'
          : response.plan?.some((entry) => entry.command)
            ? 'Local block rule preview ready.' : 'The policy returned a decision with no runnable command.';
      }
      blockTarget = null;
    } catch (error) {
      previewRetry = true;
      if (error.status === 401) refreshAuth();
      $('rules-status').textContent = error.status === 401 ? 'Sign in with Auth0 to create this rule.' : error.name === 'TimeoutError'
        ? 'The preview timed out after 15 seconds. Check the Rules list for a result before retrying.'
        : 'Could not preview the block rule. Retry preview.';
    } finally {
      policyBusy = false;
      renderPolicy();
      refreshPolicy();
    }
  }

  document.addEventListener('click', async (event) => {
    const watch = event.target.closest('[data-watch-rule]');
    if (watch) {
      const rule = policy?.rules?.find((item) => item.id === watch.dataset.watchRule);
      if (rule && canWatch(rule)) watchApproval(rule.approval);
      return;
    }
    const block = event.target.closest('[data-block-kind]');
    if (block) {
      if (policyBusy) return;
      previewRetry = false;
      blockTarget = { kind: block.dataset.blockKind, value: block.dataset.blockValue };
      $('rules-plan').hidden = true;
      $('rules-status').textContent = '';
      if (Outbound.view === 'rules') refreshPolicy();
      else Outbound.showView('rules');
      return;
    }
    const remove = event.target.closest('[data-remove-rule]');
    if (!remove || policyBusy || !authLoaded || authNeedsSignIn() || policy?.enforcer !== 'dry-run') return;
    const rule = policy.rules?.find((item) => item.id === remove.dataset.removeRule);
    if (!rule) return;
    policyBusy = true;
    renderPolicy();
    try {
      const result = await api('/api/policy/rules/' + encodeURIComponent(remove.dataset.removeRule), { method: 'DELETE' });
      if (approvalWatch && approvalWatch.id === rule.approval?.requestId) {
        approvalWatch = null;
        clearTimeout(approvalTimer);
        $('phone-approval').hidden = true;
      }
      showPlan(result.plan);
      $('rules-status').textContent = 'Rule removed.';
    } catch (error) {
      if (error.status === 401) refreshAuth();
      $('rules-status').textContent = error.status === 401 ? 'Sign in with Auth0 to remove this rule.' : 'Could not remove this rule.';
    } finally {
      policyBusy = false;
      refreshPolicy();
    }
  });
  Outbound.onView((name) => { if (name === 'rules') refreshPolicy(); });
  refreshAuth();

  const historyMetrics = [
    ['companies', 'Attributed companies'], ['trackers', 'Tracker companies'], ['countries', 'Countries'],
    ['backgroundMinutes', 'Background minutes'], ['micSeconds', 'Microphone seconds'], ['cameraSeconds', 'Camera seconds'],
  ];
  let historyRequest = 0;

  async function showWeek() {
    const request = ++historyRequest;
    const status = $('history-status');
    const output = $('history-results');
    try {
      const { days } = await api('/api/history');
      if (request !== historyRequest) return;
      const week = [...days].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
      if (!week.length) {
        status.textContent = 'No calendar days have been recorded on this PC.';
        output.replaceChildren();
        return;
      }
      status.textContent = 'Most recent ' + week.length + ' recorded days, oldest to newest. Counts sum app observations and can overlap.';
      const dayTotal = (day, key) => day.apps.some((app) => Number.isFinite(app[key]))
        ? day.apps.reduce((sum, app) => sum + (Number.isFinite(app[key]) ? app[key] : 0), 0) : null;
      const chars = '._-:=+*#';
      const series = historyMetrics.map(([key, label]) => {
        const points = week.map((day) => dayTotal(day, key));
        const peak = Math.max(1, ...points.filter(Number.isFinite));
        const trend = points.map((value) => Number.isFinite(value) ? chars[Math.round(value / peak * (chars.length - 1))] : '?').join('');
        return `<li><strong>${label}</strong> <code>[${trend}]</code><br>${points.map((point, i) =>
          esc(week[i].date.slice(5) + ': ' + (point === null ? 'unknown' : number(point)))).join(' / ')}</li>`;
      });
      const daily = [...week].reverse().map((day) => card(day.date,
        '<h3>Top apps by attributed companies</h3>' + list([...day.apps].sort((a, b) => b.companies - a.companies || b.trackers - a.trackers || a.name.localeCompare(b.name))
          .slice(0, 5).map((app) => `<strong>${esc(app.name)}</strong><br>`
            + historyMetrics.map(([key, label]) => esc(label.toLowerCase() + ': ' + number(app[key]))).join(' / ')),
        'No app observations for this day.')));
      output.innerHTML = card('Daily trends', '<ul>' + series.join('') + '</ul>') + daily.join('');
    } catch {
      if (request !== historyRequest) return;
      status.textContent = 'Local history is unavailable.';
      output.replaceChildren();
    }
  }

  Outbound.onView((name) => { if (name === 'history') showWeek(); });
})();
