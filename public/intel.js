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
    if (!response.ok) throw Object.assign(new Error('HTTP ' + response.status), { status: response.status });
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
      ? `Tracker companies were attributed to ${summary.sitesWithTrackers} of ${summary.sitesVisited} visited domains.`
      : 'No scan totals were reported.';
    return card('Scan summary', '<strong>' + esc(verdict) + '</strong>'
      + `<p>${number(summary.sitesVisited)} sites visited / ${number(summary.sitesWithTrackers)} with trackers / ${number(summary.trackerCookieDomains)} tracker cookie domains / ${size(summary.appDataBytes)} app data</p>`
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

  function scanWindows(scan) {
    const report = (key, title, render, empty) => card(title,
      Array.isArray(scan[key]) ? render(scan[key]) || `<p class="intel-muted">${esc(empty)}</p>`
        : '<p class="intel-muted">This scan section is unavailable.</p>');
    const timestamp = (value) => Number.isFinite(value) ? new Date(value).toLocaleString() : 'Time unavailable';
    const permissions = '<div id="scan-permissions">' + report('permissions', 'Permission history', (rows) => {
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
          const marker = row.inUse ? '*' : '#';
          const timeline = age >= 0 && age < 7 ? Array.from({ length: 7 }, (_, i) => i === 6 - age ? marker : '.').join('') : '.......';
          return `<code>[${timeline}]</code> ${esc(row.app)} ${researchBadge(row.researchId)}<br>`
            + esc(row.inUse ? 'In use since ' + timestamp(row.lastUsedStart) : Number.isFinite(row.lastUsedStart)
              ? timestamp(row.lastUsedStart) + (Number.isFinite(row.lastUsedStop) ? ' to ' + timestamp(row.lastUsedStop) : '') : 'No use timestamp reported');
        }), '');
      const sensitive = priority.filter((key) => groups.has(key)).map((key) => [key, groups.get(key)]);
      const other = [...groups].filter(([key]) => !priority.includes(key)).sort(([a], [b]) =>
        (labels[a] || a).localeCompare(labels[b] || b));
      return '<p>' + dossierLink('tim-hortons', 'app', 'Tim Hortons dossier') + '</p>'
        + sensitive.map(renderCapability).join('') + (other.length ? `<details class="permission-other">
        <summary>Other permissions (${other.length})</summary>${other.map(renderCapability).join('')}</details>` : '');
    }, 'No permission history was reported.') + '</div>';
    const installed = report('installed', 'Installed software', (rows) => rows.length ? list(rows.map((row) => {
      return `<strong>${esc(row.name)}</strong> ${researchBadge(row.researchId)}`
        + '<br>' + esc([row.publisher, row.version, row.installDate, Number.isFinite(row.sizeBytes) ? size(row.sizeBytes) : null].filter(Boolean).join(' / '));
    }), '') : '', 'No installed software entries were reported.');
    const autoruns = report('autoruns', 'Phones home on its own', (rows) =>
      '<p class="intel-muted">Flags are based on startup entries, scheduled tasks, and service metadata.</p>'
      + list(rows.filter((row) => row.flagged).map((row) =>
        `<strong class="ascii-warning">${esc(row.name)}</strong> / ${esc(row.kind)}<br>`
          + esc([row.publisher, row.status, row.startType, row.reason].filter(Boolean).join(' / '))),
      'No startup entries were flagged by this scan.'), 'No startup information was reported.');
    const extensions = report('extensions', 'Extensions that can read every site', (rows) => list(rows.filter((row) => row.allSites).map((row) =>
      `<strong class="ascii-warning">${esc(row.name)}</strong> / ${esc([row.browser, row.profile, row.version].filter(Boolean).join(' / '))} ${researchBadge(row.researchId)}<br>`
      + esc((row.permissions || []).join(', '))), 'No extension with all-site access was reported.'), 'No extension inventory was reported.');
    const privacy = report('windowsPrivacy', 'Windows privacy checklist', (rows) => rows.length ? list(rows.map((row) =>
      `<strong>[ ] ${esc(row.setting)}</strong><br>Current: ${esc(row.value ?? 'Unavailable')}${row.meaning ? ' / ' + esc(row.meaning) : ''}`
        + (row.recommended ? '<br>Recommended: ' + esc(row.recommended) : '')), '') : '', 'No Windows privacy values were reported.');
    return [permissions, installed, autoruns, extensions, privacy];
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
  function renderScan(scan) {
    lastScan = scan;
    const running = scan.status === 'running';
    scanButton.disabled = running || Boolean(scan.appDataBackground);
    setRadar(running);
    const messages = { idle: 'Ready when you choose to scan.', running: 'Scanning locally', done: 'Scan complete.', error: scan.error || 'The scan failed.' };
    $('scan-status').textContent = (messages[scan.status] || 'Scan status unavailable.')
      + (running && Number.isFinite(scan.progress) ? ' / ' + Math.round(scan.progress * 100) + '%' : '')
      + (scan.appDataBackground ? ' / App-data totals are provisional. The local walk is still running.' : '');
    const browsers = [];
    if (scan.status === 'done' && scan.summary) browsers.push(scanSummary(scan.summary));
    if (scan.browsers?.length) browsers.push(renderProfiles(scan.browsers));
    if (scan.apps?.length) browsers.push(card('App data at rest', list(scan.apps.map((app) =>
      `<strong>${dossierLink(app.app, 'app')}</strong> / ${esc(size(app.bytes))} / ${number(app.files)} files${app.partial ? ' / partial' : ''}<br>`
      + Object.entries(app.kinds || {}).map(([kind, count]) => esc(kind) + ': ' + number(count)).join(' / ')), '')));
    if (scan.status === 'done') {
      if (scan.warnings?.length) browsers.push(card('Scan warnings', list(scan.warnings.map(esc), '')));
      browsers.push(...scanWindows(scan));
    }
    const html = browsers.join('') || (scan.status === 'done' ? '<p>No stored-data results were reported.</p>' : '');
    const output = $('scan-results');
    if (output.dataset.model !== html) {
      output.innerHTML = html;
      output.dataset.model = html;
    }
    if (permissionJump && $('scan-permissions') && Outbound.view === 'scan') {
      permissionJump = false;
      $('scan-permissions').scrollIntoView({ block: 'start' });
    }
  }

  $('scan-results').addEventListener('click', (event) => {
    const profile = event.target.closest('[data-scan-profile]');
    const toggle = event.target.closest('[data-empty-profiles]');
    if (!lastScan || (!profile && !toggle)) return;
    if (profile) selectedProfile = Number(profile.dataset.scanProfile);
    if (toggle) showEmptyProfiles = !showEmptyProfiles;
    renderScan(lastScan);
    const target = profile ? `[data-scan-profile="${selectedProfile}"]` : '[data-empty-profiles]';
    $('scan-results').querySelector(target)?.focus();
  });

  async function refreshScan() {
    clearTimeout(scanPoll);
    try {
      const scan = await api('/api/scan');
      renderScan(scan);
      if (scan.status === 'running' || scan.appDataBackground) scanPoll = setTimeout(refreshScan, 650);
    } catch (error) {
      setRadar(false);
      scanButton.disabled = error.status === 404;
      $('scan-status').textContent = error.status === 404 ? 'Stored-data scanner is unavailable in this build.' : 'Could not read scan status.';
      if (error.status !== 404 && Outbound.view === 'scan') scanPoll = setTimeout(refreshScan, 1500);
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
  let blockTarget;
  let policyBusy = false;
  let previewedApp;
  $('rules-globe').addEventListener('click', () => Outbound.showAppOnGlobe(previewedApp));

  function blockButton(kind, value) {
    return value ? `<button type="button" class="tool-btn" data-block-kind="${esc(kind)}" data-block-value="${esc(value)}">Block ${esc(kind)}${kind === 'domain' ? ' / ' + esc(value) : ''}</button>` : '';
  }
  Outbound.blockButton = blockButton;

  function renderPolicy() {
    const pending = $('rules-pending');
    if (blockTarget) {
      pending.innerHTML = `<p>Target: ${esc(blockTarget.kind)} / ${esc(blockTarget.value)}</p><button type="button" class="tool-btn" id="rules-confirm">Preview block</button>`;
      const submit = $('rules-confirm');
      submit.disabled = policyBusy || !policy || policy.enforcer !== 'dry-run'
        || (lower(policy.provider).includes('auth0') && policy.providerConfigured);
      submit.addEventListener('click', submitBlock);
    } else pending.replaceChildren();
    if (!policy) {
      $('rules-list').textContent = 'No local policy data available.';
      return;
    }
    const auth0 = policy.auth0Configured ?? policy.providerConfigured;
    $('rules-provider').textContent = 'Decision provider: ' + policy.provider
      + ' / Auth0: ' + (auth0 == null ? 'configuration not reported' : auth0 ? 'configured' : 'not configured')
      + ' / enforcer: ' + policy.enforcer;
    $('rules-list').innerHTML = '<h2>Rules list</h2>' + list((policy.rules || []).map((rule) =>
      `${esc(rule.action)} / ${esc(rule.target.kind)} / ${esc(rule.target.value)} <button type="button" class="tool-btn" data-remove-rule="${esc(rule.id)}" ${policyBusy || policy.enforcer !== 'dry-run' || (rule.approval?.via === 'auth0' && auth0) ? 'disabled' : ''}>Remove</button>`), 'No rules saved.');
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
      else if (lower(policy.provider).includes('auth0') && policy.providerConfigured) {
        $('rules-status').textContent = 'Preview paused because the configured provider can send requests outside this PC.';
      }
    } catch {
      policy = null;
      $('rules-provider').textContent = 'Policy API unavailable in this build.';
    }
    renderPolicy();
  }

  async function submitBlock() {
    if (policyBusy || !blockTarget || policy?.enforcer !== 'dry-run'
      || (lower(policy.provider).includes('auth0') && policy.providerConfigured)) return;
    policyBusy = true;
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
        body: JSON.stringify({ target, action: 'block', scope: 'session' }),
      });
      showPlan(response.plan, response.decision);
      previewedApp = target.kind === 'app' ? target.value : null;
      $('rules-globe').hidden = !previewedApp;
      $('rules-status').textContent = 'Local block rule preview ready.';
      blockTarget = null;
    } catch {
      $('rules-status').textContent = 'Could not preview the block rule.';
    } finally {
      policyBusy = false;
      refreshPolicy();
    }
  }

  document.addEventListener('click', async (event) => {
    const block = event.target.closest('[data-block-kind]');
    if (block) {
      blockTarget = { kind: block.dataset.blockKind, value: block.dataset.blockValue };
      $('rules-plan').hidden = true;
      $('rules-status').textContent = '';
      if (Outbound.view === 'rules') refreshPolicy();
      else Outbound.showView('rules');
      return;
    }
    const remove = event.target.closest('[data-remove-rule]');
    if (!remove || policyBusy || policy?.enforcer !== 'dry-run') return;
    const rule = policy.rules?.find((item) => item.id === remove.dataset.removeRule);
    if (!rule || (rule.approval?.via === 'auth0' && (policy.auth0Configured ?? policy.providerConfigured))) return;
    policyBusy = true;
    renderPolicy();
    try {
      const result = await api('/api/policy/rules/' + encodeURIComponent(remove.dataset.removeRule), { method: 'DELETE' });
      showPlan(result.plan);
      $('rules-status').textContent = 'Rule removed.';
    } catch {
      $('rules-status').textContent = 'Could not remove this rule.';
    } finally {
      policyBusy = false;
      refreshPolicy();
    }
  });
  Outbound.onView((name) => { if (name === 'rules') refreshPolicy(); });

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
