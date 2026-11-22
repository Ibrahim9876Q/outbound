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
  const dossierLink = (name, kind = 'company') => name
    ? `<button type="button" class="intel-link" data-dossier="${esc(name)}" data-dossier-kind="${kind}">${esc(name)}</button>` : '';

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
        + (site.trackers?.length ? '<br>' + site.trackers.map((tracker) => dossierLink(tracker.company)).join(', ') : '')
        + '<br>' + dossierLink(site.company || site.domain, site.company ? 'company' : 'domain')),
      browser.historyAvailable === false ? 'History unavailable.' : 'No visited domains reported.')
      + '<h3>Tracker cookie domains</h3>'
      + list((browser.cookieDomains || []).filter((cookie) => cookie.isTracker).map((cookie) =>
        `${esc(cookie.domain)}${cookie.company ? ' / ' + dossierLink(cookie.company) : ''} / ${number(cookie.cookies)} cookies`),
      browser.cookiesAvailable === false ? 'Cookie domain list unavailable.' : 'No tracker cookie domains reported.')));
    const trackers = scan.summary?.topTrackers || [];
    if (trackers.length) {
      const max = Math.max(1, ...trackers.map((tracker) => tracker.sites));
      browsers.push(card('Tracker companies across sites', list(trackers.map((tracker) =>
        `${esc(tracker.company)}<br><code>${'#'.repeat(Math.max(0, Math.min(20, Math.round(tracker.sites / max * 20))))}</code> ${number(tracker.sites)} sites`), '')));
    }
    if (scan.apps?.length) browsers.push(card('App data at rest', list(scan.apps.map((app) =>
      `<strong>${dossierLink(app.app, 'app')}</strong> / ${esc(size(app.bytes))} / ${number(app.files)} files<br>`
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

  let research;
  let researchLoading;
  let selection;
  const lower = (value) => String(value ?? '').trim().toLowerCase();
  const entries = (record, key) => (record[key] || []).filter((item) => item.source?.verified === true);
  const fields = ['declared', 'sharesWith', 'destinations', 'incidents'];

  function sourceHTML(source) {
    let url;
    try {
      const parsed = new URL(source.url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href;
    } catch { /* Invalid citations stay plain text. */ }
    const details = [source.publisher, source.date].filter(Boolean).join(' / ') || 'Source metadata unavailable';
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
    output.innerHTML = `<h2>${esc(selected.name)}</h2>`
      + (selected.publisher ? `<p>${esc(selected.publisher)}</p>` : '')
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
      const incidents = research.reduce((sum, record) => sum + entries(record, 'incidents').length, 0);
      const sources = new Set(research.flatMap((record) => fields.flatMap((key) => entries(record, key).map((item) => item.source.url).filter(Boolean))));
      $('dossier-count').textContent = (data.apps || []).length + ' apps / ' + incidents + ' incidents / ' + sources.size + ' sources';
    } catch {
      $('dossier-count').textContent = 'Verified research is unavailable in this build.';
    } finally {
      researchLoading = false;
      renderDossier();
    }
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-dossier]');
    if (!trigger) return;
    selection = [trigger.dataset.dossierKind, trigger.dataset.dossier];
    if (Outbound.view !== 'dossier') Outbound.showView('dossier');
    else renderDossier();
  });
  $('dossier-search').addEventListener('input', renderDossier);
  $('dossier-kind').addEventListener('change', renderDossier);
  Outbound.onView((name) => { if (name === 'dossier') loadResearch(); });

  let policy;
  let blockTarget;
  let policyBusy = false;

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
    const auth0 = policy.auth0Configured ?? (lower(policy.provider).includes('auth0') ? policy.providerConfigured : null);
    $('rules-provider').textContent = 'Decision provider: ' + policy.provider
      + ' / Auth0: ' + (auth0 == null ? 'configuration not reported' : auth0 ? 'configured' : 'not configured')
      + ' / enforcer: ' + policy.enforcer;
    $('rules-list').innerHTML = '<h2>Rules list</h2>' + list((policy.rules || []).map((rule) =>
      `${esc(rule.action)} / ${esc(rule.target.kind)} / ${esc(rule.target.value)} <button type="button" class="tool-btn" data-remove-rule="${esc(rule.id)}" ${policyBusy || policy.enforcer !== 'dry-run' ? 'disabled' : ''}>Remove</button>`), 'No rules saved.');
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
      const response = await api('/api/policy/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: blockTarget, action: 'block', scope: 'session' }),
      });
      showPlan(response.plan, response.decision);
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
})();
