// Shared by every view: the live connection to the server, the top bar, view tabs and small helpers.
//
// API for other views (window.Outbound):
//   Outbound.onState(fn)   fn(state) on every /events "state" (about once a second). Called right away if a state exists.
//   Outbound.onEvent(fn)   fn(event) for each live server event (new-destination, new-link, mic-on, ...).
//   Outbound.onView(fn)    fn(viewName) when the user switches tabs ("computer" | "globe" | "phone").
//   Outbound.state         the latest state, or null before the first one arrives.
//   Outbound.view          the current view name.
//   Outbound.util          { esc, flag, flagHtml, countryName, ago, duration, initials, appColor, appLabel, deviceAppName,
//                            deviceUsers, eventText, svgIcon }
(function () {
  'use strict';

  const stateFns = [];
  const eventFns = [];
  const viewFns = [];
  const discoveryFns = [];
  const Outbound = { state: null, view: 'computer', util: {} };
  window.Outbound = Outbound;
  let bootPending = true;

  function showBoot(state) {
    if (!bootPending) return;
    bootPending = false;
    try {
      if (sessionStorage.getItem('outbound.boot')) return;
      sessionStorage.setItem('outbound.boot', 'seen');
    } catch { /* Storage can be disabled. */ }
    const overlay = document.createElement('section');
    overlay.className = 'boot-console';
    overlay.setAttribute('aria-label', 'Outbound startup');
    const output = document.createElement('pre');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'Skip startup';
    const socketCount = state.apps.reduce((total, app) => total + (app.activeConnections || 0), 0);
    const lines = [
      '+---------------------+\n|   O U T B O U N D   |\n+---------------------+',
      '[ OK ] local state received',
      '[ OK ] Windows device status: ' + (state.devices.source || 'reported'),
      '[ OK ] ' + socketCount + ' active connections observed',
    ];
    overlay.append(output, skip);
    document.body.append(overlay);
    const finish = () => overlay.remove();
    skip.addEventListener('click', finish);
    overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') finish(); });
    skip.focus();
    lines.forEach((line, i) => setTimeout(() => { if (overlay.isConnected) output.textContent += line + '\n'; }, i * 180));
    setTimeout(finish, 1250);
  }

  Outbound.onState = (fn) => { stateFns.push(fn); if (Outbound.state) safe(fn, Outbound.state); };
  Outbound.onEvent = (fn) => { eventFns.push(fn); };
  Outbound.onView = (fn) => { viewFns.push(fn); };
  Outbound.showView = showView;
  Outbound.onDiscovery = (fn) => { discoveryFns.push(fn); };
  Outbound.exposureGauge = (score) => {
    if (!Number.isFinite(score?.value)) return '[??????????] Unknown';
    const filled = Math.max(0, Math.min(10, Math.round(score.value / 10)));
    return '[' + '#'.repeat(filled) + '.'.repeat(10 - filled) + '] ' + score.value + '/100';
  };

  let scoreRequestedAt = -Infinity;
  let scorePending = false;
  Outbound.onState(async () => {
    if (scorePending || performance.now() - scoreRequestedAt < 3000) return;
    scoreRequestedAt = performance.now();
    scorePending = true;
    try {
      const response = await fetch('/api/score', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (!response.ok) return;
      const { overall } = await response.json();
      setText('stat-exposure', overall?.value ?? 'Unknown');
      $('score-overall').title = Outbound.exposureGauge(overall)
        + ' / Evidence coverage: ' + (overall?.coverage ?? 'unknown') + '/100. Missing evidence is unknown.';
    } catch { /* The last available score remains visible. */ }
    finally { scorePending = false; }
  });

  function safe(fn, arg) {
    try { fn(arg); } catch (err) { console.error(err); }
  }

  // ---------- helpers ----------

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  // "US" -> 🇺🇸 (regional indicator letters)
  function flag(cc) {
    if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
    return String.fromCodePoint(...cc.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }

  // Windows has no flag emoji glyphs (it draws the two letters), so check once and fall back to a code badge.
  let flagsSupported = null;
  function emojiFlagsSupported() {
    if (flagsSupported !== null) return flagsSupported;
    flagsSupported = false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 20;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(flag('CA'), 0, 0);
      const px = ctx.getImageData(0, 0, 20, 20).data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] && Math.max(Math.abs(px[i] - px[i + 1]), Math.abs(px[i + 1] - px[i + 2])) > 40) { flagsSupported = true; break; }
      }
    } catch { /* no canvas: use badges */ }
    return flagsSupported;
  }

  // A flag emoji where the system can draw one, otherwise a small "US" badge (class "cc").
  function flagHtml(cc) {
    if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
    const title = esc(countryName(cc));
    return emojiFlagsSupported()
      ? `<span class="flag" title="${title}">${flag(cc)}</span>`
      : `<span class="cc" title="${title}">${cc.toUpperCase()}</span>`;
  }

  let regionNames = null;
  function countryName(cc) {
    if (!cc) return 'Unknown country';
    try {
      regionNames = regionNames || new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(cc.toUpperCase()) || cc;
    } catch { return cc; }
  }

  function ago(at, now = Date.now()) {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s} sec ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }

  function duration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  function initials(name) {
    const words = String(name || '?').replace(/\.exe$/i, '').split(/[\s._-]+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0] || '?').slice(0, 2).toUpperCase();
  }

  // Stable per-app hue, so the same app has the same color in every view.
  function appColor(id, light = 62) {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `hsl(${h % 360} 85% ${light}%)`;
  }

  const norm = (s) => String(s || '').toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]/g, '');

  // Which network apps are using the mic / camera right now.
  // Returns { mic: Map(appId -> label), camera: Map(appId -> label), unmatched: { mic: [label], camera: [label] } }.
  // Device apps are matched by exe id first (from the registry entry that is still "in use"), then by name.
  function deviceUsers(state) {
    const out = { mic: new Map(), camera: new Map(), unmatched: { mic: [], camera: [] } };
    if (!state || !state.devices) return out;
    const apps = state.apps || [];
    const byId = new Map(apps.map((app) => [app.id.toLowerCase(), app]));
    for (const kind of ['mic', 'camera']) {
      const dev = state.devices[kind];
      if (!dev || !dev.active) continue;
      const liveIds = (dev.lastUsedByApp || []).filter((e) => e.stop === 0);
      for (const user of dev.apps) {
        if (user.id) {
          const match = byId.get(user.id.toLowerCase());
          if (match) out[kind].set(match.id, user.app);
          else out.unmatched[kind].push(user.app);
          continue;
        }
        const ids = liveIds.filter((e) => e.label === user.app).map((e) => e.id);
        const want = norm(user.app);
        const match = apps.find((a) => ids.includes(a.id))
          || apps.find((a) => norm(a.id) === want || norm(a.name) === want)
          || (want.length >= 4 && apps.find((a) => norm(a.name).includes(want) || want.includes(norm(a.id))));
        if (match) out[kind].set(match.id, user.app);
        else out.unmatched[kind].push(user.app);
      }
    }
    return out;
  }

  // The server names a process "pid-1234" when Windows wouldn't say which exe it is (it exited or is protected).
  function appLabel(name) {
    const m = /^pid-(\d+)(\.exe)?$/i.exec(String(name || ''));
    return m ? `Unknown app (PID ${m[1]})` : name;
  }

  // Friendly name for an app the registry reports using the mic/camera ("chrome" -> "Google Chrome").
  function deviceAppName(label, state = Outbound.state) {
    const apps = (state && state.apps) || [];
    const want = norm(label);
    const entries = state && state.devices
      ? [...(state.devices.mic.lastUsedByApp || []), ...(state.devices.camera.lastUsedByApp || [])]
      : [];
    const ids = entries.filter((e) => e.label === label).map((e) => e.id);
    const app = apps.find((a) => ids.includes(a.id)) || apps.find((a) => norm(a.id) === want);
    if (app) return appLabel(app.name);
    return String(label).charAt(0).toUpperCase() + String(label).slice(1);
  }

  function place(e) {
    return e.country ? ` (${e.country})` : '';
  }

  // One readable sentence per server event.
  function eventText(e) {
    switch (e.type) {
      case 'background-talk': {
        const companies = [...new Set(e.companies || [])].sort();
        const target = companies.length ? companies.join(', ') : 'unattributed endpoints';
        return `${appLabel(e.app)} talked to ${target} in the background`;
      }
      case 'new-company': return `${appLabel(e.app)} discovered ${e.org || 'a new company'}${place(e)}`;
      case 'new-destination':
        return e.tracker
          ? `${appLabel(e.app)} connected to tracker ${e.org}${place(e)}`
          : `${appLabel(e.app)} connected to ${e.org}${place(e)}`;
      case 'new-link': return `${appLabel(e.from)} ↔ ${appLabel(e.to)} started talking directly`;
      case 'mic-on': return `Microphone turned on by ${deviceAppName(e.app)}`;
      case 'mic-off': return `${deviceAppName(e.app)} stopped using the microphone${e.durationMs ? ` (${duration(e.durationMs)})` : ''}`;
      case 'camera-on': return `Camera turned on by ${deviceAppName(e.app)}`;
      case 'camera-off': return `${deviceAppName(e.app)} stopped using the camera${e.durationMs ? ` (${duration(e.durationMs)})` : ''}`;
      default: return e.app ? `Observed activity from ${appLabel(e.app)}` : 'Observed local activity';
    }
  }

  // Small inline icons (stroke = currentColor).
  const ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/><path class="slash" d="M4 3l16 18"/>',
    cam: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>',
    camOff: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/><path class="slash" d="M3 4l18 17"/>',
  };
  function svgIcon(name, cls = '') {
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  Outbound.util = { esc, flag, countryName, ago, duration, initials, appColor, appLabel, deviceAppName, deviceUsers, eventText, svgIcon, flagHtml };

  // ---------- top bar ----------

  const $ = (id) => document.getElementById(id);

  function setText(id, value) {
    const node = $(id);
    if (node && node.textContent !== String(value)) node.textContent = value;
  }

  const counters = new Map();
  let counterFrame = 0;

  function tickCount(id, value) {
    const element = $(id);
    if (counters.get(id)?.to === value || (!counters.has(id) && Number(element.textContent) === value)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(Number(element.textContent))) {
      counters.delete(id);
      element.textContent = value;
      return;
    }
    counters.set(id, { element, from: Number(element.textContent) || 0, to: value, start: performance.now() });
    if (!counterFrame) counterFrame = requestAnimationFrame(animateCounters);
  }

  function animateCounters(now) {
    for (const [id, { element, from, to, start }] of counters) {
      const t = Math.max(0, Math.min(1, (now - start) / 280));
      element.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
      if (t === 1) counters.delete(id);
    }
    counterFrame = counters.size ? requestAnimationFrame(animateCounters) : 0;
  }

  function renderTopbar(state) {
    const orgs = new Set(), countries = new Set(), trackers = new Set();
    let online = 0, live = 0;
    for (const app of state.apps) {
      let appLive = false;
      for (const d of app.destinations) {
        if (d.org && d.org !== 'Unknown owner') orgs.add(d.org);
        if (d.country) countries.add(d.country);
        if (d.tracker) trackers.add(d.org);
        if (d.active) { appLive = true; live += d.sockets || 1; }
      }
      if (appLive) online++;
    }
    tickCount('stat-apps', online);
    tickCount('stat-companies', orgs.size);
    tickCount('stat-countries', countries.size);
    tickCount('stat-trackers', trackers.size);
    $('stat-trackers').parentElement.classList.toggle('hot', trackers.size > 0);

    devicePill('pill-mic', 'Mic', state.devices.mic, state);
    devicePill('pill-cam', 'Camera', state.devices.camera, state);
    const phone = state.phone;
    $('pill-phone').classList.toggle('on', Boolean(phone));
    setText('phone-text', phone ? `Phone · ${phone.lookups} lookups · ${phone.blocked} blocked` : 'Phone · Offline');
    setText('phone-view-status', phone
      ? `${phone.lookups} lookups / ${phone.blocked} blocked`
      : 'Phone gateway offline.');
    setText('live-text', `Live · ${live} connection${live === 1 ? '' : 's'}`);
  }

  function devicePill(id, label, dev, state) {
    const pill = $(id);
    if (!pill || !dev) return;
    pill.classList.toggle('on', dev.active);
    const text = dev.active ? `${label} · ${dev.apps.map((a) => deviceAppName(a.app, state)).join(', ')}` : `${label} off`;
    const last = pill.lastChild;
    if (last.nodeType === Node.TEXT_NODE) { if (last.textContent !== text) last.textContent = text; }
    else pill.append(text);
  }

  // ---------- view tabs ----------

  function showView(name) {
    if (!document.getElementById(`view-${name}`)) return;
    if (Outbound.view !== name && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => applyView(name));
    } else {
      applyView(name);
    }
  }

  function applyView(name) {
    Outbound.view = name;
    for (const btn of document.querySelectorAll('.view-btn[data-view]')) {
      const on = btn.dataset.view === name;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on);
    }
    for (const view of document.querySelectorAll('main > .view')) view.classList.toggle('hidden', view.id !== `view-${name}`);
    try { history.replaceState(null, '', `#${name}`); } catch { /* file:// or sandboxed */ }
    for (const fn of viewFns) safe(fn, name);
  }

  // ---------- live connection ----------

  const trackersSeen = new Set();
  const pendingDiscoveries = [];
  const pageOpenedAt = Date.now();
  const sessionCompanies = new Set();
  const sessionCountries = new Set();
  const sessionTrackers = new Set();
  const sessionUse = { mic: [], camera: [] };
  let discoveryTimer = null;
  let discoveryShownAt = -Infinity;
  let discoveryToast;
  const socketSamples = [];
  let sampledAt = 0;

  function renderSession(state) {
    if (state.at - sampledAt >= 1000) {
      sampledAt = state.at;
      socketSamples.push(state.apps.reduce((sum, app) => sum + (app.activeConnections || 0), 0));
      if (socketSamples.length > 24) socketSamples.shift();
      const peak = Math.max(1, ...socketSamples);
      const ascii = '._-:=+*#';
      setText('socket-sparkline', 'Sockets [' + socketSamples.map((total) => ascii[Math.round(total / peak * (ascii.length - 1))]).join('') + ']');
    }
    for (const app of state.apps) {
      for (const destination of app.destinations) {
        if (!destination.active && !(destination.lastSeen >= pageOpenedAt)) continue;
        if (destination.country) sessionCountries.add(destination.country);
        if (!destination.org || destination.org === 'Unknown owner') continue;
        const key = destination.org.trim().toLowerCase();
        sessionCompanies.add(key);
        if (destination.tracker) sessionTrackers.add(key);
      }
    }
    const seconds = {};
    for (const kind of ['mic', 'camera']) {
      const device = state.devices[kind];
      const observed = [
        ...sessionUse[kind],
        ...(device.recentSessions || []).map(({ start, stop }) => [start, stop]),
        ...device.apps.map(({ since }) => [since, state.at]),
      ].map(([start, stop]) => [Math.max(pageOpenedAt, start), Math.min(state.at, stop)])
        .filter(([start, stop]) => stop > start).sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const range of observed) {
        const previous = merged.at(-1);
        if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
        else merged.push(range);
      }
      sessionUse[kind] = merged;
      seconds[kind] = Math.floor(merged.reduce((sum, [start, stop]) => sum + stop - start, 0) / 1000);
    }
    const count = (set, singular, plural) => `${set.size} ${set.size === 1 ? singular : plural}`;
    setText('session-strip', 'Since you opened Outbound: '
      + [count(sessionCompanies, 'company', 'companies'), count(sessionCountries, 'country', 'countries'),
        count(sessionTrackers, 'tracker', 'trackers'), `mic ${seconds.mic}s`, `cam ${seconds.camera}s`].join(' · '));
  }

  function discoverTrackers(state, initial) {
    for (const app of state.apps) {
      for (const destination of app.destinations) {
        if (!destination.tracker || !destination.org || destination.org === 'Unknown owner') continue;
        const key = destination.org.trim().toLowerCase();
        if (trackersSeen.has(key)) continue;
        trackersSeen.add(key);
        if (!initial || destination.firstSeen >= pageOpenedAt) {
          pendingDiscoveries.push({ key, org: destination.org, country: destination.country, app: appLabel(app.name), appId: app.id });
        }
      }
    }
    if (pendingDiscoveries.length && discoveryTimer === null) {
      discoveryTimer = setTimeout(showDiscovery, Math.max(0, discoveryShownAt + 3000 - performance.now()));
    }
  }

  function showDiscovery() {
    discoveryTimer = null;
    const [lead, ...rest] = pendingDiscoveries.splice(0);
    discoveryShownAt = performance.now();
    if (!discoveryToast) {
      discoveryToast = document.createElement('div');
      discoveryToast.className = 'discovery-toast';
      discoveryToast.setAttribute('role', 'status');
      document.querySelector('main').append(discoveryToast);
    }
    const title = document.createElement('strong');
    title.textContent = 'NEW TRACKER';
    const text = document.createElement('span');
    text.textContent = `${lead.org}${lead.country ? ' (' + lead.country + ')' : ''} via ${lead.app}`
      + (rest.length ? ` · +${rest.length} more` : '');
    discoveryToast.replaceChildren(title, text);
    discoveryToast.hidden = false;
    for (const fn of discoveryFns) safe(fn, lead);
    setTimeout(() => { discoveryToast.hidden = true; }, 2800);
  }

  function connect() {
    const pill = $('pill-live');
    let source;
    let connected = false;
    let waitingFresh = false;
    let retry = 500;

    function applyDeviceEvent(event) {
      const match = /^(mic|camera)-(on|off)$/.exec(event.type);
      if (!match || !Outbound.state || waitingFresh || !event.app) return;
      const [, kind, action] = match;
      const state = Outbound.state;
      const device = state.devices[kind];
      const appName = event.app.toLowerCase();
      const id = event.appId || event.id || device.lastUsedByApp?.find((entry) => entry.label?.toLowerCase() === appName)?.id
        || state.apps.find((app) => app.name.toLowerCase() === appName || app.id.replace(/\.exe$/i, '').toLowerCase() === appName)?.id;
      const matching = device.apps.filter((app) => id && app.id ? app.id.toLowerCase() === id.toLowerCase() : app.app.toLowerCase() === appName);
      let apps = device.apps;
      if (action === 'on' && !matching.length) {
        apps = [...apps, { id, app: event.app, since: event.at }];
      } else if (action === 'off' && matching.length === 1) {
        apps = apps.filter((app) => app !== matching[0]);
      }
      if (apps === device.apps) return;
      const updated = { ...state, devices: { ...state.devices, [kind]: { ...device, apps, active: apps.length > 0 } } };
      Outbound.state = updated;
      safe(renderTopbar, updated);
      for (const fn of stateFns) safe(fn, updated);
    }

    function publish(state) {
      if (!state || !Array.isArray(state.apps) || (Outbound.state && state.at < Outbound.state.at)) return;
      if (state.fresh === false || (waitingFresh && state.fresh !== true)) {
        pill.classList.add('down');
        setText('live-text', Outbound.state ? 'Stale / waiting for fresh sample' : 'Waiting for first sample');
        return;
      }
      if (connected) {
        waitingFresh = false;
        pill.classList.remove('down');
      }
      const initial = !Outbound.state;
      Outbound.state = state;
      safe(showBoot, state);
      safe(renderTopbar, state);
      safe(renderSession, state);
      for (const fn of stateFns) safe(fn, state);
      discoverTrackers(state, initial);
      if (!connected && pill.classList.contains('down')) setText('live-text', 'Reconnecting…');
    }

    async function refresh(current) {
      try {
        const response = await fetch('/api/state', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
        if (response.ok) {
          const state = await response.json();
          if (source === current) publish(state);
        }
      } catch { /* The event stream retries independently. */ }
    }

    function open() {
      const current = source = new EventSource('/events');
      current.onopen = () => {
        connected = true;
        retry = 500;
        if (waitingFresh) setText('live-text', 'Stale / waiting for fresh sample');
        refresh(current);
      };
      current.addEventListener('state', (message) => {
        try { publish(JSON.parse(message.data)); } catch { /* Ignore malformed messages. */ }
      });
      current.addEventListener('event', (message) => {
        let event;
        try { event = JSON.parse(message.data); } catch { return; }
        applyDeviceEvent(event);
        for (const fn of eventFns) safe(fn, event);
        if (/^(mic|camera)-(on|off)$/.test(event.type)) refresh(current);
      });
      current.onerror = () => {
        if (source !== current) return;
        current.close();
        source = null;
        connected = false;
        waitingFresh = Boolean(Outbound.state);
        pill.classList.add('down');
        setText('live-text', waitingFresh ? 'Stale / reconnecting…' : 'Reconnecting…');
        setTimeout(open, retry);
        retry = Math.min(8000, retry * 2);
      };
    }

    open();
    refresh(source);
  }

  // ---------- high contrast (projectors) ----------

  function setHighContrast(on) {
    document.body.classList.toggle('hc', on);
    const btn = $('hc-btn');
    if (btn) btn.setAttribute('aria-pressed', on);
    try { localStorage.setItem('outbound.hc', on ? '1' : '0'); } catch { /* storage blocked */ }
  }

  function start() {
    let hc = false;
    try { hc = localStorage.getItem('outbound.hc') === '1'; } catch { /* storage blocked */ }
    setHighContrast(hc);
    $('hc-btn')?.addEventListener('click', () => setHighContrast(!document.body.classList.contains('hc')));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') setHighContrast(!document.body.classList.contains('hc'));
    });
    // Only buttons with data-view switch views; the Phone tab is a plain link to the phone dashboard.
    for (const btn of document.querySelectorAll('.view-btn[data-view]')) {
      btn.addEventListener('click', () => { if (!btn.disabled) showView(btn.dataset.view); });
    }
    const fromHash = location.hash.slice(1);
    if (fromHash && fromHash !== 'computer') showView(fromHash);
    // Editing the #hash in the address bar doesn't reload the page, so follow it here too.
    window.addEventListener('hashchange', () => showView(location.hash.slice(1) || 'computer'));
    connect();
  }

  // Scripts load at the end of <body>, but other views register their listeners after this file runs,
  // so connect on the next tick to let them subscribe first.
  setTimeout(start, 0);
})();
