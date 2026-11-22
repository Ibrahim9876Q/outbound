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
  const Outbound = { state: null, view: 'computer', util: {} };
  window.Outbound = Outbound;

  Outbound.onState = (fn) => { stateFns.push(fn); if (Outbound.state) safe(fn, Outbound.state); };
  Outbound.onEvent = (fn) => { eventFns.push(fn); };
  Outbound.onView = (fn) => { viewFns.push(fn); };

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
    for (const kind of ['mic', 'camera']) {
      const dev = state.devices[kind];
      if (!dev || !dev.active) continue;
      const liveIds = (dev.lastUsedByApp || []).filter((e) => e.stop === 0);
      for (const user of dev.apps) {
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
      case 'new-destination':
        return e.tracker
          ? `${appLabel(e.app)} connected to tracker ${e.org}${place(e)}`
          : `${appLabel(e.app)} connected to ${e.org}${place(e)}`;
      case 'new-link': return `${appLabel(e.from)} ↔ ${appLabel(e.to)} started talking directly`;
      case 'mic-on': return `Microphone turned on by ${deviceAppName(e.app)}`;
      case 'mic-off': return `${deviceAppName(e.app)} stopped using the microphone${e.durationMs ? ` (${duration(e.durationMs)})` : ''}`;
      case 'camera-on': return `Camera turned on by ${deviceAppName(e.app)}`;
      case 'camera-off': return `${deviceAppName(e.app)} stopped using the camera${e.durationMs ? ` (${duration(e.durationMs)})` : ''}`;
      default: return e.type;
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
    setText('stat-apps', online);
    setText('stat-companies', orgs.size);
    setText('stat-countries', countries.size);
    setText('stat-trackers', trackers.size);
    $('stat-trackers').parentElement.classList.toggle('hot', trackers.size > 0);

    devicePill('pill-mic', 'Mic', state.devices.mic, state);
    devicePill('pill-cam', 'Camera', state.devices.camera, state);
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

  function connect() {
    const pill = $('pill-live');
    let source;
    let connected = false;
    let retry = 500;

    function publish(state) {
      if (!state || !Array.isArray(state.apps) || (Outbound.state && state.at < Outbound.state.at)) return;
      Outbound.state = state;
      safe(renderTopbar, state);
      for (const fn of stateFns) safe(fn, state);
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
        pill.classList.remove('down');
        refresh(current);
      };
      current.addEventListener('state', (message) => {
        try { publish(JSON.parse(message.data)); } catch { /* Ignore malformed messages. */ }
      });
      current.addEventListener('event', (message) => {
        let event;
        try { event = JSON.parse(message.data); } catch { return; }
        for (const fn of eventFns) safe(fn, event);
      });
      current.onerror = () => {
        if (source !== current) return;
        current.close();
        source = null;
        connected = false;
        pill.classList.add('down');
        setText('live-text', 'Reconnecting…');
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
    connect();
  }

  // Scripts load at the end of <body>, but other views register their listeners after this file runs,
  // so connect on the next tick to let them subscribe first.
  setTimeout(start, 0);
})();
