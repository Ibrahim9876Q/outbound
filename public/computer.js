// Computer view: a drawn laptop whose screen is a desktop of the apps using the network, with wires
// showing where each app sends data, plus the live webcam LED and mic key.
(function () {
  'use strict';

  const { esc, flagHtml, countryName, ago, duration, initials, appLabel, deviceAppName, deviceUsers, eventText, svgIcon } = Outbound.util;
  const $ = (id) => document.getElementById(id);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const el = {
    stage: document.querySelector('#view-computer .stage'),
    toggles: document.querySelector('#view-computer .wire-toggles'),
    laptop: document.querySelector('#view-computer .laptop'),
    lid: document.querySelector('#view-computer .lid'),
    base: document.querySelector('#view-computer .base'),
    footnote: $('footnote'),
    screen: $('screen'),
    flash: $('flash'),
    internet: $('internet'),
    internetSub: $('internet-sub'),
    orgs: $('orgs'),
    wires: $('wires'),
    wirePaths: $('wire-paths'),
    packets: $('packets'),
    packetLayer: $('packet-layer'),
    desktop: $('desktop'),
    empty: $('empty'),
    toasts: $('toasts'),
    keyboard: $('keyboard'),
    clock: $('clock'),
    feed: $('feed'),
    detail: $('app-detail'),
    hint: $('app-hint'),
  };

  const ICON_W = 96;  // .app width in computer.css
  const TILE_TOP = 6;  // .app padding-top
  const TILE = 44;     // .tile size
  const SLOT_W = 104;
  const SLOT_H = 104;
  const MAX_IDLE_LABELS = 4;  // "both → X" labels shown when no app is selected
  const FRESH_MS = 90 * 1000; // apps that just started talking get priority for a desktop spot

  let lastState = null;
  let selected = null;       // selected app id
  let firstState = true;

  // ---------- keyboard ----------

  // [label, width, id] — the function row holds the mic-mute and camera keys like a real laptop.
  const KEY_ROWS = [
    { cls: 'fn', keys: [['esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['mic', 2.6, 'key-mic'], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['cam', 2.6, 'key-cam'], ['F10', 1], ['F11', 1], ['F12', 1], ['del', 1]] },
    { keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 1.9]] },
    { keys: [['tab', 1.5], ...'QWERTYUIOP[]'.split('').map((k) => [k, 1]), ['\\', 1.4]] },
    { keys: [['caps', 1.8], ...'ASDFGHJKL;\''.split('').map((k) => [k, 1]), ['enter', 2.1]] },
    { keys: [['shift', 2.3], ...'ZXCVBNM,./'.split('').map((k) => [k, 1]), ['shift', 2.6]] },
    { keys: [['ctrl', 1.2], ['fn', 1], ['⊞', 1], ['alt', 1.2], ['', 6.2], ['alt', 1.2], ['ctrl', 1.2], ['◂', 1], ['▴▾', 1], ['▸', 1]] },
  ];

  function buildKeyboard() {
    el.keyboard.innerHTML = KEY_ROWS.map((row) => `<div class="krow ${row.cls || ''}">${row.keys.map(([label, w, id]) => {
      if (id === 'key-mic') return `<div class="key hero" id="key-mic" style="--w:${w}" title="Microphone">${heroKey('mic', false)}</div>`;
      if (id === 'key-cam') return `<div class="key hero" id="key-cam" style="--w:${w}" title="Camera">${heroKey('cam', false)}</div>`;
      return `<div class="key" style="--w:${w}">${esc(label)}</div>`;
    }).join('')}</div>`).join('');
  }

  function heroKey(kind, on) {
    const icon = kind === 'mic' ? (on ? 'mic' : 'micOff') : (on ? 'cam' : 'camOff');
    const state = kind === 'mic' ? (on ? 'live' : 'muted') : (on ? 'on' : 'off');
    return `${svgIcon(icon)}<span class="kl"><b>${kind.toUpperCase()}</b><small>${state}</small></span>`;
  }

  // ---------- fit the laptop to the window ----------

  function fitLaptop() {
    const stage = el.stage;
    const cs = getComputedStyle(stage);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.rowGap) || 0;
    const minWidth = parseFloat(cs.getPropertyValue('--laptop-min-width')) || 0;
    const availW = stage.clientWidth - padX;
    const availH = stage.clientHeight - padY - el.toggles.offsetHeight - el.footnote.offsetHeight - gap * 2;
    if (availW <= 0 || availH <= 0 || !el.laptop.offsetWidth) return;
    // Measure the projected keyboard deck, then fill whichever stage dimension runs out first.
    for (let pass = 0; pass < 2; pass++) {
      const w0 = el.laptop.offsetWidth;
      const baseRect = el.base.getBoundingClientRect();
      const visualH = baseRect.bottom - el.lid.getBoundingClientRect().top;
      const visualW = Math.max(w0, baseRect.width);
      const widthLimit = Math.min(1600, availW * w0 / visualW);
      const preferred = Math.max(minWidth, availH * w0 / visualH);
      const w = Math.max(1, Math.floor(Math.min(widthLimit, preferred)));
      el.laptop.style.setProperty('--lw', `${w}px`);
      const squash = el.base.offsetHeight - el.base.getBoundingClientRect().height;
      el.laptop.style.setProperty('--base-squash', `${Math.max(0, squash)}px`);
    }
  }

  // ---------- mic + camera ----------

  function renderDevice(kind, dev, state) {
    const isMic = kind === 'mic';
    const names = dev.apps.map((a) => deviceAppName(a.app, state));
    const who = names.join(', ');
    const longest = dev.apps.reduce((m, a) => Math.max(m, Date.now() - a.since), 0);

    const key = $(isMic ? 'key-mic' : 'key-cam');
    const wasOn = key.classList.contains('on');
    if (wasOn !== dev.active) {
      key.classList.toggle('on', dev.active);
      key.innerHTML = heroKey(isMic ? 'mic' : 'cam', dev.active);
    }

    const caption = $(isMic ? 'mic-caption' : 'cam-caption');
    caption.classList.toggle('on', dev.active);
    caption.textContent = dev.active ? `● ${isMic ? 'Mic' : 'Cam'}: ${who}` : (isMic ? 'Mic muted' : 'Cam off');
    caption.title = dev.active ? `${who} is using your ${isMic ? 'microphone' : 'camera'}` : '';

    $(isMic ? 'tray-mic' : 'tray-cam').classList.toggle('on', dev.active);

    if (!isMic) {
      const cam = $('cam');
      cam.classList.toggle('on', dev.active);
      el.laptop.classList.toggle('cam-on', dev.active);
      $('cam-label').textContent = dev.active ? `● REC · ${who}` : 'Camera off';
      if (dev.active && !wasOn && !firstState) {
        flashScreen();
        burstCameraLight(cam);
      }
    }

    const prefix = isMic ? 'mic' : 'cam';
    $(`card-${prefix}`).classList.toggle('on', dev.active);
    $(`${prefix}-status`).textContent = dev.active ? `In use by ${who} · ${duration(longest)}` : 'Not in use';
    $(`${prefix}-sessions`).textContent = dev.sessionsToday;
    $(`${prefix}-time`).textContent = duration(dev.totalMsToday);
    renderUsage($(`${prefix}-usage`), dev, state);
  }

  // Most recent apps first: who is using it now, then the last time each app used it (from the Windows registry).
  function renderUsage(list, dev, state) {
    const now = Date.now();
    const rows = [];
    const seen = new Set();
    for (const a of dev.apps) {
      seen.add(a.app.toLowerCase());
      rows.push({ now: true, text: `<span class="who">${esc(deviceAppName(a.app, state))}</span><span class="when">· now · ${duration(now - a.since)} so far</span>` });
    }
    for (const e of dev.lastUsedByApp || []) {
      if (e.stop === 0 || seen.has(e.label.toLowerCase())) continue;
      seen.add(e.label.toLowerCase());
      rows.push({ text: `<span class="who">${esc(deviceAppName(e.label, state))}</span><span class="when">· ${ago(e.stop, now)} · ${duration(e.stop - e.start)} long</span>` });
      if (rows.length >= 4) break;
    }
    const html = rows.length
      ? rows.slice(0, 4).map((r) => `<li class="${r.now ? 'now' : ''}"><span class="dot"></span>${r.text}</li>`).join('')
      : '<li class="none">No apps have used it yet</li>';
    if (list.innerHTML !== html) list.innerHTML = html;
  }

  function burstCameraLight(cam) {
    if (reducedMotion.matches) return;
    cam.classList.remove('burst');
    void cam.offsetWidth; // restart the animation
    cam.classList.add('burst');
    setTimeout(() => cam.classList.remove('burst'), 1200);
  }

  function flashScreen() {
    if (reducedMotion.matches) return;
    el.flash.classList.remove('go');
    void el.flash.offsetWidth; // restart the animation
    el.flash.classList.add('go');
  }

  // ---------- "The internet" strip ----------

  const orgChips = new Map(); // org -> chip element
  let moreChip = null;
  let visibleOrgs = new Map(); // org -> chip element currently shown

  function summarizeOrgs(state) {
    const orgs = new Map();
    for (const app of state.apps) {
      for (const d of app.destinations) {
        let o = orgs.get(d.org);
        if (!o) orgs.set(d.org, o = { org: d.org, apps: new Set(), sockets: 0, active: false, tracker: false, countries: new Map() });
        o.apps.add(app.id);
        if (d.active) { o.active = true; o.sockets += d.sockets || 1; }
        if (d.tracker) o.tracker = true;
        if (d.country) o.countries.set(d.country, (o.countries.get(d.country) || 0) + 1);
      }
    }
    // The selected app's companies come first so its wires all land on visible chips.
    const score = (o) => (selected && o.apps.has(selected) ? 1e4 : 0) + (o.org === 'Unknown owner' ? -100 : 0)
      + o.apps.size * 4 + o.sockets + (o.tracker ? 6 : 0) + (o.active ? 3 : 0);
    return [...orgs.values()].sort((a, b) => score(b) - score(a) || a.org.localeCompare(b.org));
  }

  function renderOrgs(state) {
    const list = summarizeOrgs(state);
    const seen = new Set();
    if (!moreChip) {
      moreChip = document.createElement('div');
      moreChip.className = 'org more';
    }
    list.forEach((o) => {
      seen.add(o.org);
      let chip = orgChips.get(o.org);
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'org';
        chip.dataset.org = o.org;
        if (!firstState) chip.classList.add('fresh');
        orgChips.set(o.org, chip);
      }
      const cc = [...o.countries.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
      const html = `${cc.slice(0, 2).map(flagHtml).join('')}<span class="org-label">${esc(o.org)}</span>${o.apps.size > 1 ? `<span class="n">×${o.apps.size}</span>` : ''}`;
      if (chip.dataset.html !== html) { chip.innerHTML = html; chip.dataset.html = html; }
      chip.classList.toggle('tracker', o.tracker);
      chip.title = `${o.org}${o.tracker ? ' · tracker / analytics' : ''} · used by ${o.apps.size} app${o.apps.size > 1 ? 's' : ''}`;
    });
    for (const [org, chip] of orgChips) if (!seen.has(org)) { chip.remove(); orgChips.delete(org); }

    // Put chips in order (only touching the DOM when the order changed), then hide what doesn't fit.
    const ordered = list.map((o) => orgChips.get(o.org));
    const current = [...el.orgs.children].filter((c) => c !== moreChip);
    if (ordered.length !== current.length || ordered.some((c, i) => c !== current[i])) {
      for (const chip of ordered) el.orgs.appendChild(chip);
    }
    el.orgs.appendChild(moreChip);
    for (const chip of ordered) chip.hidden = false;
    moreChip.hidden = false;
    moreChip.textContent = '+99 more';
    const room = el.orgs.clientWidth - moreChip.offsetWidth - 8;
    visibleOrgs = new Map();
    let hidden = 0;
    for (const chip of ordered) {
      const fits = chip.offsetLeft - el.orgs.offsetLeft + chip.offsetWidth <= room && hidden === 0;
      chip.hidden = !fits;
      if (fits) visibleOrgs.set(chip.dataset.org, chip); else hidden++;
    }
    moreChip.textContent = `+${hidden} more`;
    moreChip.hidden = hidden === 0;
    moreChip.title = list.slice(list.length - hidden).map((o) => o.org).join(', ');

    const countries = new Set(list.flatMap((o) => [...o.countries.keys()]));
    el.internetSub.textContent = list.length
      ? `· ${list.length} compan${list.length === 1 ? 'y' : 'ies'} in ${countries.size} countr${countries.size === 1 ? 'y' : 'ies'}`
      : '';
  }

  // Bottom-center of a chip in screen coordinates (where wires end).
  function chipAnchor(chip) {
    return {
      x: el.internet.offsetLeft + chip.offsetLeft + chip.offsetWidth / 2,
      y: el.internet.offsetTop + chip.offsetTop + chip.offsetHeight,
    };
  }

  // ---------- desktop icons ----------

  const icons = new Map(); // app id -> { node, slot, app }
  let slots = [];          // [{ x, y, taken }]
  let gridKey = '';

  function buildSlots(appCount) {
    const W = Math.round(el.screen.clientWidth);
    const H = Math.round(el.screen.clientHeight);
    const top = el.internet.offsetTop + el.internet.offsetHeight + 12;
    const bottom = H - 38 - 8;
    const left = 14, right = W - 14;
    const rowHeight = Math.max(SLOT_H, ...[...icons.values()].map(({ node }) =>
      node.hidden ? 0 : node.offsetHeight + 4));
    const rows = Math.max(1, Math.floor((bottom - top) / rowHeight));
    const standardCols = Math.max(1, Math.floor((right - left) / SLOT_W));
    const compact = appCount > standardCols * rows;
    const iconWidth = compact ? 76 : ICON_W;
    const cols = compact ? Math.max(standardCols, Math.floor((right - left) / 81)) : standardCols;
    const key = `${W}x${H}@${top}/${iconWidth}/${rowHeight}`;
    if (key === gridKey) return false;
    gridKey = key;
    el.desktop.style.setProperty('--desktop-icon-width', `${iconWidth}px`);
    const cellW = (right - left) / cols;
    const cellH = (bottom - top) / rows;
    const focus = { x: W / 2, y: top + (bottom - top) * 0.45 };
    slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = Math.round(left + c * cellW + (cellW - iconWidth) / 2);
      const y = Math.round(top + r * cellH + (cellH - rowHeight) / 2);
      const cx = x + iconWidth / 2, cy = y + rowHeight / 2;
      // Fill from the middle outward, preferring wide rows over tall columns.
      slots.push({ x, y, width: iconWidth, taken: null, rank: Math.abs(cx - focus.x) / W + Math.abs(cy - focus.y) / H * 1.6 });
    }
    slots.sort((a, b) => a.rank - b.rank);
    return true;
  }

  // Apps shown on the desktop: any with network activity, plus anything using the mic or camera.
  function desktopApps(state, users) {
    const unresolved = state.apps.filter((app) => /^pid-\d+(?:\.exe)?$/i.test(app.id));
    const list = state.apps.filter((app) => !unresolved.includes(app))
      .map((a) => ({ ...a, name: appLabel(a.name), mic: users.mic.has(a.id), cam: users.camera.has(a.id) }));
    if (unresolved.length) {
      const destinations = unresolved.flatMap((app) => app.destinations);
      const countOwners = (rows) => new Set(rows.map((destination) => destination.org).filter((org) => org && org !== 'Unknown owner')).size;
      list.push({
        id: 'system:protected', name: `System and protected processes (${unresolved.length})`,
        icon: null, protectedProcesses: unresolved, destinations, localPeers: [],
        activeConnections: unresolved.reduce((total, app) => total + app.activeConnections, 0),
        companies: countOwners(destinations), trackers: countOwners(destinations.filter((destination) => destination.tracker)),
        mic: unresolved.some((app) => users.mic.has(app.id)), cam: unresolved.some((app) => users.camera.has(app.id)),
      });
    }
    for (const kind of ['mic', 'camera']) {
      for (const label of users.unmatched[kind]) {
        const id = `device:${label.toLowerCase()}`;
        let app = list.find((a) => a.id === id);
        if (!app) list.push(app = { id, name: deviceAppName(label, state), icon: null, destinations: [], localPeers: [], companies: 0, trackers: 0, activeConnections: 0, mic: false, cam: false });
        app[kind === 'mic' ? 'mic' : 'cam'] = true;
      }
    }
    const now = Date.now();
    for (const a of list) {
      const born = a.destinations.reduce((m, d) => Math.min(m, d.firstSeen), Infinity);
      // Processes Windows couldn't name rank below every named app.
      const unknown = Boolean(a.protectedProcesses);
      const fresh = !unknown && now - born < FRESH_MS;
      a.priority = (a.mic || a.cam ? 1e6 : 0) + (fresh ? 1e4 : 0) + (unknown ? 0 : 1e3) + a.activeConnections * 10 + a.destinations.length;
    }
    // Two different exes with the same friendly name (chatgpt.exe and codex.exe are both "Codex").
    const counts = new Map();
    for (const a of list) counts.set(a.name, (counts.get(a.name) || 0) + 1);
    for (const a of list) a.dupe = counts.get(a.name) > 1;
    return list.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  function renderDesktop(state, users) {
    if (el.screen.clientWidth < 200) return;
    const apps = desktopApps(state, users);
    if (buildSlots(apps.length)) {
      // Grid changed size: re-place everything, busiest apps nearest the middle.
      for (const icon of icons.values()) icon.slot = null;
      for (const s of slots) s.taken = null;
    }
    const keep = new Set(apps.map((a) => a.id));
    for (const [id, icon] of icons) {
      if (keep.has(id)) continue;
      if (icon.slot) icon.slot.taken = null;
      icon.node.remove();
      icons.delete(id);
      if (selected === id) select(null);
    }
    let hiddenApps = 0;
    for (const app of apps) {
      let icon = icons.get(app.id);
      if (!icon) {
        icon = { node: makeIcon(app), slot: null, app };
        icons.set(app.id, icon);
        icon.node.style.setProperty('--entry-delay', Math.min(180, icons.size * 18) + 'ms');
        icon.node.classList.add('entering');
      }
      icon.app = app;
      if (!icon.slot) {
        const free = slots.find((s) => !s.taken) || evictFor(app);
        if (free) { free.taken = app.id; icon.slot = free; }
      }
      if (!icon.slot) { icon.node.hidden = true; hiddenApps++; continue; }
      icon.node.hidden = false;
      if (!icon.node.isConnected) el.desktop.appendChild(icon.node);
      icon.node.style.left = `${icon.slot.x}px`;
      icon.node.style.top = `${icon.slot.y}px`;
      updateIcon(icon.node, app);
    }
    el.empty.hidden = apps.length > 0;
    placeToasts();
    el.desktop.dataset.hidden = hiddenApps;
  }

  // Desktop full: give the spot of the least important app to a clearly more important one.
  function evictFor(app) {
    let victim = null;
    for (const icon of icons.values()) {
      if (icon.slot && (!victim || icon.app.priority < victim.app.priority)) victim = icon;
    }
    if (!victim || app.priority < victim.app.priority * 1.5 + 20) return null;
    const slot = victim.slot;
    victim.slot = null;
    victim.node.hidden = true;
    slot.taken = null;
    return slot;
  }

  // "chatgpt.exe"; apps seen only through the mic/camera have no exe.
  function exeLabel(app) {
    return app.protectedProcesses ? 'Unresolved executables' : app.id.startsWith('device:') ? 'mic / camera only' : app.id;
  }

  function tileInner(app) {
    return app.icon
      ? `<img alt="" src="data:image/png;base64,${app.icon}">`
      : `<span class="initials">${esc(initials(app.name))}</span>`;
  }

  function makeIcon(app) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'app';
    node.dataset.id = app.id;
    if (app.protectedProcesses) node.setAttribute('aria-expanded', 'false');
    node.innerHTML = `<span class="tile">${tileInner(app)}<span class="badge tr" hidden></span><span class="badge co" hidden></span><span class="badge dev" hidden></span></span><span class="name"></span><span class="sub" hidden></span>`;
    node.addEventListener('click', (e) => { e.stopPropagation(); select(selected === app.id ? null : app.id); });
    return node;
  }

  function updateIcon(node, app) {
    const name = node.querySelector('.name');
    if (name.textContent !== app.name) name.textContent = app.name;
    const sub = node.querySelector('.sub');
    sub.hidden = !app.dupe;
    node.classList.toggle('dupe', !!app.dupe);
    if (app.dupe && sub.textContent !== exeLabel(app)) sub.textContent = exeLabel(app);
    if (app.icon && !node.querySelector('img')) {
      // The real icon arrived after the app first appeared.
      node.querySelector('.initials')?.remove();
      const tile = node.querySelector('.tile');
      tile.insertAdjacentHTML('afterbegin', tileInner(app));
    }
    const co = node.querySelector('.badge.co');
    co.hidden = !app.companies;
    co.textContent = app.companies;
    const tr = node.querySelector('.badge.tr');
    tr.hidden = !app.trackers;
    tr.textContent = app.trackers;
    tr.classList.toggle('ascii-warning', Boolean(app.trackers));
    const dev = node.querySelector('.badge.dev');
    const devKind = app.cam ? 'cam' : app.mic ? 'mic' : '';
    if (dev.dataset.kind !== devKind) {
      dev.dataset.kind = devKind;
      dev.hidden = !devKind;
      dev.className = `badge dev ${devKind}`;
      dev.innerHTML = devKind ? svgIcon(devKind === 'cam' ? 'cam' : 'mic') : '';
    }
    node.classList.toggle('mic', app.mic);
    node.classList.toggle('cam', app.cam);
    node.classList.toggle('idle', !app.activeConnections && !app.mic && !app.cam);
    node.classList.toggle('selected', selected === app.id);
    node.classList.toggle('dim', !!selected && selected !== app.id && !isRelated(app.id));
    const parts = [`${app.name}`, `${app.companies} compan${app.companies === 1 ? 'y' : 'ies'}`];
    if (app.trackers) parts.push(`${app.trackers} tracker connection${app.trackers === 1 ? '' : 's'}`);
    if (app.mic) parts.push('using the microphone');
    if (app.cam) parts.push('using the camera');
    node.title = parts.join(' · ');
    node.setAttribute('aria-label', app.dupe ? app.name + ' (' + exeLabel(app) + ')' : app.name);
    node.setAttribute('aria-pressed', String(selected === app.id));
    if (app.protectedProcesses) node.setAttribute('aria-expanded', String(selected === app.id));
    node.setAttribute('aria-controls', 'app-detail');
  }

  function isRelated(id) {
    if (!selected || !lastState) return false;
    return (lastState.legacyLinks || lastState.links).some((l) => (l.from === selected && l.to === id) || (l.to === selected && l.from === id));
  }

  // Positions on the screen, from the icon's slot.
  function iconPoint(id, where) {
    const icon = icons.get(id);
    if (!icon || !icon.slot || icon.node.hidden) return null;
    const x = icon.slot.x + icon.slot.width / 2;
    if (where === 'top') return { x, y: icon.slot.y + TILE_TOP };
    if (where === 'bottom') return { x, y: icon.slot.y + icon.node.offsetHeight };
    return { x, y: icon.slot.y + TILE_TOP + TILE / 2 };
  }

  // ---------- wires ----------

  const wires = new Map(); // key -> wire

  function wireSpecs(state) {
    const specs = [];
    for (const icon of icons.values()) {
      const app = icon.app;
      if (!icon.slot || icon.node.hidden) continue;
      const groups = new Map();
      for (const d of app.destinations) {
        const chip = visibleOrgs.get(d.org) || (moreChip && !moreChip.hidden ? moreChip : null);
        if (!chip) continue;
        const target = chip === moreChip ? '+more' : d.org;
        let g = groups.get(target);
        if (!g) groups.set(target, g = { chip, sockets: 0, active: false, tracker: false });
        if (d.active) { g.active = true; g.sockets += d.sockets || 1; }
        if (d.tracker) g.tracker = true;
      }
      const from = iconPoint(app.id, 'top');
      for (const [target, g] of groups) {
        const to = chipAnchor(g.chip);
        const lift = (from.y - to.y) * 0.5;
        specs.push({
          key: `out|${app.id}|${target}`, kind: 'out', apps: [app.id], org: target,
          pts: [from, { x: from.x, y: from.y - lift }, { x: to.x, y: to.y + lift * 0.8 }, to],
          active: g.active, tracker: g.tracker,
          rate: g.active ? Math.min(6, 0.35 + g.sockets * 0.45) : 0,
        });
      }
    }
    for (const link of groupLinks(state.links)) {
      const kind = link.kind;
      const a = iconPoint(link.from, kind === 'local' ? 'top' : 'bottom');
      const b = iconPoint(link.to, kind === 'local' ? 'top' : 'bottom');
      if (!a || !b) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      let pts;
      if (kind === 'local') {
        const h = 36 + dist * 0.28;
        pts = [a, { x: a.x, y: a.y - h }, { x: b.x, y: b.y - h }, b];
      } else {
        const floor = el.screen.clientHeight - 48;
        const h = Math.min(30 + dist * 0.22, Math.max(10, (floor - Math.max(a.y, b.y)) / 0.75));
        pts = [a, { x: a.x, y: a.y + h }, { x: b.x, y: b.y + h }, b];
      }
      specs.push({
        key: `${kind}|${link.from}|${link.to}`, kind, apps: [link.from, link.to], vias: link.vias,
        pts, active: link.active, tracker: false, dist,
        rate: kind === 'local' && link.active ? 2.2 : 0,
      });
    }
    const kinds = new Set(['loopback', 'parent', 'pipe', 'udp', 'shared-company', 'shared-tracker']);
    const appNames = new Map();
    for (const { app } of icons.values()) {
      appNames.set(app.name.toLowerCase(), appNames.has(app.name.toLowerCase()) ? null : app.id);
    }
    const resolve = (name) => icons.has(name) ? name : appNames.get(String(name).toLowerCase());
    for (const link of state.links) {
      if (!kinds.has(link.kind)) continue;
      let endpointIds = [];
      try { endpointIds = JSON.parse(link.id); } catch { /* Older IDs can be opaque. */ }
      const idsMatch = Array.isArray(endpointIds) && endpointIds[0] === link.kind;
      const from = resolve(idsMatch ? endpointIds[1] : link.from) || resolve(link.from);
      const to = resolve(idsMatch ? endpointIds[2] : link.to) || resolve(link.to);
      const hub = String(link.to).startsWith('company:')
        && (visibleOrgs.get(link.to.slice(8)) || (moreChip && !moreChip.hidden ? moreChip : null));
      const a = iconPoint(from, 'center');
      const b = hub ? chipAnchor(hub) : iconPoint(to, 'center');
      if (!a || !b) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const lift = Math.max(24, Math.min(80, dist * 0.35));
      const self = !dist;
      const pts = [a, { x: a.x + (self ? 38 : 0), y: a.y - lift },
        { x: b.x + (self ? 38 : 0), y: b.y + (self ? lift : -lift) }, b];
      specs.push({
        key: link.id || [link.kind, link.from, link.to].join('|'), kind: link.kind,
        apps: [from, to].filter(Boolean), active: true, tracker: link.kind === 'shared-tracker',
        pts, dist, evidence: [link.confidence, link.evidence].filter(Boolean).join(' / '),
        rate: link.kind === 'loopback' ? 2.2 : 0,
      });
    }
    return specs;
  }

  // Hosting / CDN / OS companies nearly every app touches. Two apps "both using Cloudflare" is plumbing,
  // not a story, so these shared links only appear when one of the two apps is selected.
  const INFRA_ORG = /cloudflare|akamai|fastly|amazon web services|cloudfront|google cloud|azure|^microsoft$|digitalocean|vultr|ovh|hetzner|linode|oracle|edgio|edgecast|lumen|level 3|unknown owner/i;

  // One wire per pair of apps: shared links list every company the pair has in common.
  function groupLinks(links) {
    const pairs = new Map();
    for (const link of links) {
      if (link.kind !== 'local' && link.kind !== 'shared') continue;
      const kind = link.kind === 'local' ? 'local' : 'shared';
      if (kind === 'shared' && INFRA_ORG.test(link.via) && selected !== link.from && selected !== link.to) continue;
      const [from, to] = [link.from, link.to].sort();
      const key = `${kind}|${from}|${to}`;
      let g = pairs.get(key);
      if (!g) pairs.set(key, g = { kind, from, to, vias: [], active: false });
      if (link.via && !g.vias.includes(link.via)) g.vias.push(link.via);
      g.active = g.active || link.active;
    }
    return [...pairs.values()];
  }

  function sharedLabel(vias) {
    return `both → ${vias[0]}${vias.length > 1 ? ` +${vias.length - 1}` : ''}`;
  }

  // Place "both → X" labels so they never overlap each other or an app icon; drop the ones that can't fit.
  function placeLabels(list) {
    const H = el.screen.clientHeight;
    const boxes = [
      { x: -1e4, y: -1e4, w: 2e4, h: 1e4 + el.internet.offsetHeight + 4 },
      { x: -1e4, y: H - 44, w: 2e4, h: 1e4 },
    ];
    for (const icon of icons.values()) {
      if (!icon.slot || icon.node.hidden) continue;
      boxes.push({ x: icon.slot.x, y: icon.slot.y, w: icon.slot.width, h: icon.node.offsetHeight });
    }
    let budget = selected ? Infinity : MAX_IDLE_LABELS;
    const hits = (b) => boxes.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
    const ranked = list.slice().sort((a, b) => (b.hi - a.hi) || (a.dist - b.dist));
    for (const w of ranked) {
      const text = w.hi && w.vias.length > 1 ? `both → ${w.vias.slice(0, 3).join(', ')}` : sharedLabel(w.vias);
      if (w.label.textContent !== text) w.label.textContent = text;
      const width = text.length * 7.4 + 8;
      let placed = null;
      for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) {
        const p = bezier(w.pts, t);
        const box = { x: p.x - width / 2, y: p.y + 2, w: width, h: 17 };
        if (!hits(box)) { placed = box; break; }
      }
      if (placed && budget-- <= 0) placed = null;
      w.label.style.display = placed ? '' : 'none';
      if (!placed) continue;
      boxes.push(placed);
      w.label.setAttribute('x', (placed.x + width / 2).toFixed(1));
      w.label.setAttribute('y', (placed.y + 13).toFixed(1));
    }
  }

  function pathD(p) {
    const f = (n) => n.toFixed(1);
    return `M${f(p[0].x)},${f(p[0].y)} C${f(p[1].x)},${f(p[1].y)} ${f(p[2].x)},${f(p[2].y)} ${f(p[3].x)},${f(p[3].y)}`;
  }

  function renderWires(state) {
    if (el.screen.clientWidth < 200) return;
    const specs = wireSpecs(state);
    const seen = new Set();
    for (const spec of specs) {
      seen.add(spec.key);
      let w = wires.get(spec.key);
      if (!w) {
        w = { ...spec, acc: Math.random(), path: document.createElementNS(SVG_NS, 'path'), label: null };
        w.path.dataset.key = spec.key;
        el.wirePaths.appendChild(w.path);
        if (spec.kind === 'shared') {
          w.label = document.createElementNS(SVG_NS, 'text');
          w.label.setAttribute('class', 'wire-label shared');
          el.wirePaths.appendChild(w.label);
        }
        wires.set(spec.key, w);
      }
      const hi = !!selected && spec.apps.includes(selected);
      Object.assign(w, { pts: spec.pts, active: spec.active, tracker: spec.tracker, rate: spec.rate, apps: spec.apps, vias: spec.vias, dist: spec.dist, hi });
      const d = pathD(spec.pts);
      if (w.d !== d) { w.d = d; w.path.setAttribute('d', d); }
      w.path.setAttribute('class', `wire ${w.kind}${w.tracker ? ' tracker' : ''}${w.active ? '' : ' closed'}${hi ? ' hi' : ''}`);
      if (spec.evidence) {
        let title = w.path.querySelector('title');
        if (!title) title = w.path.appendChild(document.createElementNS(SVG_NS, 'title'));
        title.textContent = spec.evidence;
      }
      if (w.label) w.label.setAttribute('class', `wire-label shared${hi ? ' hi' : ''}`);
    }
    for (const [key, w] of wires) {
      if (seen.has(key)) continue;
      w.path.remove();
      if (w.label) w.label.remove();
      wires.delete(key);
    }
    placeLabels([...wires.values()].filter((w) => w.label && (!selected || w.hi)));
    if (selected) for (const w of wires.values()) if (w.label && !w.hi) w.label.style.display = 'none';
    // Highlight the companies the selected app talks to.
    const hitOrgs = new Set(specs.filter((s) => s.kind === 'out' && selected && s.apps.includes(selected)).map((s) => s.org));
    for (const [org, chip] of visibleOrgs) {
      chip.classList.toggle('hit', hitOrgs.has(org));
      chip.classList.toggle('dim', !!selected && !hitOrgs.has(org));
    }
    if (moreChip) moreChip.classList.toggle('hit', hitOrgs.has('+more'));
    el.wires.classList.toggle('focus', !!selected);
    el.packetLayer.classList.toggle('focus', !!selected);
  }

  function bezier(p, t) {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x, y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y };
  }

  // ---------- packets: one requestAnimationFrame loop for every wire ----------

  const packets = [];      // live packets { wire, t, dur, dir, node }
  const pool = [];         // spare <circle> nodes
  const MAX_PACKETS = 260;
  let rafId = 0;
  let lastFrame = 0;

  function spawn(w, dir) {
    if (packets.length >= MAX_PACKETS) return;
    const node = pool.pop() || el.packets.appendChild(document.createElementNS(SVG_NS, 'circle'));
    const color = w.kind === 'local' ? 'var(--local)' : w.tracker ? 'var(--tracker)' : 'var(--out)';
    node.setAttribute('r', w.kind === 'local' ? 3.6 : 2.8);
    node.setAttribute('fill', color);
    node.setAttribute('class', `packet ${w.kind}${selected && !w.apps.includes(selected) ? ' dim' : ''}`);
    node.style.display = '';
    const dur = Math.max(0.42, 1.5 - w.rate * 0.14) + Math.random() * 0.22;
    packets.push({ wire: w, t: 0, dur, dir, node });
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const show = { out: $('show-out').checked, local: $('show-local').checked };
    if (!reducedMotion.matches) {
      for (const w of wires.values()) {
        if (!w.rate || !(show[w.kind] ?? show.local) || !wires.has(w.path.dataset.key)) continue;
        w.acc += w.rate * dt;
        while (w.acc >= 1) {
          w.acc -= 1;
          // Local links: data shoots both ways.
          spawn(w, w.kind === 'local' && Math.random() < 0.5 ? -1 : 1);
        }
      }
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.t += dt / p.dur;
      if (p.t >= 1 || wires.get(p.wire.path.dataset.key) !== p.wire) {
        p.node.style.display = 'none';
        pool.push(p.node);
        packets.splice(i, 1);
        continue;
      }
      const eased = p.t * p.t * (3 - 2 * p.t);
      const t = p.dir > 0 ? eased : 1 - eased;
      const pt = bezier(p.wire.pts, t);
      p.node.setAttribute('cx', pt.x.toFixed(1));
      p.node.setAttribute('cy', pt.y.toFixed(1));
      p.node.setAttribute('opacity', (Math.min(1, p.t * 8, (1 - p.t) * 6) * Math.min(1, 0.52 + p.wire.rate / 9)).toFixed(2));
    }
  }

  function runLoop() {
    const want = Outbound.view === 'computer' && !document.hidden;
    if (want && !rafId) { lastFrame = 0; rafId = requestAnimationFrame(frame); }
    if (!want && rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function applyToggles() {
    for (const layer of [el.wires, el.packetLayer]) {
      layer.classList.toggle('hide-out', !$('show-out').checked);
      layer.classList.toggle('hide-local', !$('show-local').checked);
      layer.classList.toggle('hide-shared', !$('show-shared').checked);
    }
  }

  // ---------- selection + app details ----------

  function select(id, fromSpotlight = false) {
    if (!fromSpotlight && spotlightTimer) toggleSpotlight(false);
    selected = id;
    if (lastState) {
      renderOrgs(lastState);
      for (const icon of icons.values()) updateIcon(icon.node, icon.app);
      renderWires(lastState);
      for (const p of packets) p.node.classList.toggle('dim', !!selected && !p.wire.apps.includes(selected));
    }
    renderDetail();
    if (selected) {
      // Scroll only the side panel (scrollIntoView would also nudge the whole page).
      const card = $('card-app');
      const side = card.parentElement;
      side.scrollTo({ top: card.offsetTop - side.offsetTop - 12, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }

  function renderDetail() {
    const icon = selected && icons.get(selected);
    el.hint.hidden = !!icon;
    if (!icon) { el.detail.innerHTML = ''; delete el.detail.dataset.html; return; }
    const app = icon.app;
    const tile = app.icon ? tileInner(app) : `<span class="initials">${esc(initials(app.name))}</span>`;
    const live = app.destinations.filter((d) => d.active).length;
    const dev = [app.mic && 'using the microphone', app.cam && 'using the camera'].filter(Boolean);
    let html = `<div class="detail-head"><div class="tile">${tile}</div><div><h3>${esc(app.name)}</h3><p class="exe">${esc(exeLabel(app))}</p>`
      + `<p>${app.companies} compan${app.companies === 1 ? 'y' : 'ies'} · ${live} live of ${app.destinations.length} servers${app.trackers ? ` · <span style="color:var(--tracker)">${app.trackers} tracker</span>` : ''}${dev.length ? ` · ${dev.join(', ')}` : ''}</p></div></div>`;
    if (!app.protectedProcesses) html += appXray(app);
    if (app.protectedProcesses) {
      html += '<div class="detail-sub">System and protected processes</div><ul class="dests protected-list">'
        + app.protectedProcesses.map((process) => {
          const pid = /^pid-(\d+)/i.exec(process.id)?.[1];
          const remote = [...new Set(process.destinations.flatMap((destination) => destination.ports || []))].sort((a, b) => a - b);
          const udp = [...new Set((process.udp || []).map((listener) => listener.localPort))].sort((a, b) => a - b);
          return `<li><strong>PID ${esc(pid)}</strong><br>`
            + (remote.length ? 'Remote TCP ports: ' + remote.join(', ') : 'No remote TCP ports observed')
            + (udp.length ? '<br>Local UDP ports: ' + udp.join(', ') : '') + '</li>';
        }).join('') + '</ul>';
    }
    if (app.destinations.length) {
      html += '<div class="detail-sub">Connected to endpoints attributed to</div><ul class="dests">';
      html += app.destinations.slice(0, 40).map((d) => {
        const where = [d.city, d.country ? countryName(d.country) : null].filter(Boolean).join(', ') || 'Unknown location';
        const host = d.host ? `<code>${esc(d.host)}</code>` : `<code>${esc(d.ip)}</code>`;
        const ports = d.ports && d.ports.length ? ` · port ${d.ports.slice(0, 4).join(', ')}` : '';
        return `<li class="dest"><span class="live ${d.active ? 'on' : ''}" title="${d.active ? 'Connected now' : 'Closed'}"></span>`
          + `<span class="org-name">${esc(d.org)} ${d.tracker ? '<span class="tag tracker">tracker</span>' : ''}</span>`
          + `<span class="meta">${host}<br>${flagHtml(d.country)} ${esc(where)}${ports}${d.active ? '' : ' · closed'}`
          + (Outbound.blockButton?.('company', d.org !== 'Unknown owner' ? d.org : '') || '')
          + (Outbound.blockButton?.('domain', d.host) || '') + '</span></li>';
      }).join('');
      html += '</ul>';
    }
    if (app.localPeers && app.localPeers.length) {
      html += '<div class="detail-sub">Talks directly to (on this PC)</div>';
      html += [...new Set(app.localPeers)].map((id) => {
        const peer = lastState.apps.find((a) => a.id === id);
        const link = (lastState.legacyLinks || lastState.links).find((l) => l.kind === 'local' && ((l.from === id && l.to === app.id) || (l.to === id && l.from === app.id)));
        return `<div class="peer"><span class="sw local"></span>${esc(appLabel(peer ? peer.name : id))}${link && link.ports.length ? ` <span class="hint">· port ${link.ports.slice(0, 3).join(', ')}</span>` : ''}</div>`;
      }).join('');
    }
    const shared = (lastState.legacyLinks || lastState.links).filter((l) => l.kind === 'shared' && (l.from === app.id || l.to === app.id));
    if (shared.length) {
      html += '<div class="detail-sub">Sends to the same company as</div>';
      html += shared.map((l) => {
        const other = lastState.apps.find((a) => a.id === (l.from === app.id ? l.to : l.from));
        return `<div class="peer"><span class="sw shared"></span>${esc(appLabel(other ? other.name : '?'))} <span class="hint">· both → ${esc(l.via)}</span></div>`;
      }).join('');
    }
    if (el.detail.dataset.html !== html) {
      const scroll = el.detail.querySelector('.dests')?.scrollTop || 0;
      el.detail.innerHTML = html;
      el.detail.dataset.html = html;
      const dests = el.detail.querySelector('.dests');
      if (dests) dests.scrollTop = scroll;
    }
  }

  function appXray(app) {
    const companies = new Map();
    const countries = new Set();
    for (const destination of app.destinations) {
      if (destination.country) countries.add(destination.country);
      if (!destination.org || destination.org === 'Unknown owner') continue;
      const key = destination.org.toLowerCase();
      const company = companies.get(key) || { name: destination.org, tracker: false, category: null };
      company.tracker ||= destination.tracker;
      company.category ||= destination.trackerCategory;
      companies.set(key, company);
    }
    const groups = { ads: [], analytics: [], 'data broker': [], 'Other trackers': [], 'Other companies': [] };
    for (const company of companies.values()) {
      const group = company.tracker ? (company.category || 'Other trackers') : 'Other companies';
      (groups[group] || groups['Other trackers']).push(company.name);
    }
    const trackers = [...companies.values()].filter((company) => company.tracker).length;
    const verdict = companies.size
      ? `${app.name} talked to ${companies.size} ${companies.size === 1 ? 'company' : 'companies'}`
        + (countries.size ? ` in ${countries.size} ${countries.size === 1 ? 'country' : 'countries'}` : '')
        + `${trackers ? `; ${trackers} ${trackers === 1 ? 'is a tracker' : 'are trackers'}` : ''}.`
      : `No company identified for ${app.name} yet.`;
    const labels = { ads: 'Advertising', analytics: 'Analytics', 'data broker': 'Data brokers' };
    const orgs = Object.entries(groups).filter(([, names]) => names.length).map(([category, names]) =>
      `<div class="xray-group"><strong>${labels[category] || category}</strong><span>${esc(names.sort().join(', '))}</span></div>`).join('');
    const flags = [...countries].sort().map((code) => `<span>${flagHtml(code)} ${esc(countryName(code))}</span>`).join('');
    const history = ['mic', 'camera'].map((kind) => {
      const device = lastState.devices[kind];
      const entry = (device.lastUsedByApp || []).find((row) => row.id.toLowerCase() === app.id.toLowerCase());
      const matches = (row) => row.id ? row.id.toLowerCase() === app.id.toLowerCase()
        : Boolean(entry && row.app.toLowerCase() === entry.label.toLowerCase());
      const active = device.apps.find(matches);
      const sessions = device.recentSessions.filter(matches).slice(0, 3);
      const lines = sessions.map((session) => `${ago(session.stop)} · ${duration(session.stop - session.start)}`);
      if (!lines.length && entry?.stop) lines.push(`${ago(entry.stop)} · ${duration(entry.stop - entry.start)}`);
      if (active) lines.unshift('In use now');
      return `<div class="xray-group"><strong>${kind === 'mic' ? 'Microphone' : 'Camera'}</strong><span>${lines.map(esc).join('<br>') || 'No use recorded'}</span></div>`;
    }).join('');
    return `<section class="app-xray" aria-label="App X-ray"><p class="xray-verdict">${esc(verdict)}</p>`
      + (app.protectedProcesses ? '' : `<button type="button" class="tool-btn" data-xray-globe ${app.destinations.length ? '' : 'disabled'}>Show on globe</button>`
        + `<button type="button" class="tool-btn" data-dossier="${esc(app.id)}" data-dossier-kind="app">Open dossier</button>`)
      + (Outbound.blockButton?.('app', app.id.endsWith('.exe') ? app.id : '') || '')
      + orgs + (flags ? `<div class="xray-countries">${flags}</div>` : '') + history + '</section>';
  }

  // ---------- live feed + toasts ----------

  const feedItems = new Map(); // key -> li

  function eventClass(e) {
    if (e.type.startsWith('mic')) return 'mic';
    if (e.type.startsWith('camera')) return 'camera';
    if (e.type === 'new-link') return 'link';
    return e.tracker ? 'tracker' : '';
  }

  function renderFeed(state) {
    const now = Date.now();
    const bySignature = new Map();
    const events = [];
    for (const event of [...state.events].sort((a, b) => b.at - a.at)) {
      const message = eventText(event);
      const signature = JSON.stringify([event.type, event.appId || event.app || event.from, message, event.tracker]);
      const newer = bySignature.get(signature);
      if (newer && newer.event.at - event.at <= 30000) {
        newer.count++;
        newer.oldest = event.at;
      } else {
        const group = { event, message, count: 1, oldest: event.at, signature };
        bySignature.set(signature, group);
        events.push(group);
      }
    }
    if (!events.length) {
      if (!el.feed.querySelector('.none')) el.feed.innerHTML = '<li class="none">Nothing yet. Open an app or a website and watch it appear here.</li>';
      return;
    }
    el.feed.querySelector('.none')?.remove();
    const keys = new Set();
    let anchor = el.feed.firstChild;
    for (const { event: e, message, count, oldest, signature } of events.slice(0, 40)) {
      const key = signature + '|' + oldest;
      keys.add(key);
      let li = feedItems.get(key);
      if (!li) {
        li = document.createElement('li');
        li.className = eventClass(e);
        li.innerHTML = '<span class="feed-app" aria-hidden="true"></span><span class="msg"></span><span class="t"></span>';
        const app = state.apps.find((app) => app.id === e.appId || app.name === (e.app || e.from));
        li.firstElementChild.innerHTML = app ? tileInner(app) : esc(initials(e.app || e.from || 'System'));
        if (!firstState) li.classList.add('feed-enter');
        feedItems.set(key, li);
      }
      if (li !== anchor) el.feed.insertBefore(li, anchor);
      anchor = li.nextSibling;
      const text = message + (count > 1 ? ' x' + count : '');
      if (li.querySelector('.msg').textContent !== text) li.querySelector('.msg').textContent = text;
      const t = li.querySelector('.t');
      const when = ago(e.at, now);
      if (t.textContent !== when) t.textContent = when;
    }
    for (const [key, li] of feedItems) if (!keys.has(key)) { li.remove(); feedItems.delete(key); }
  }

  function toast(e) {
    const cls = eventClass(e);
    const isDevice = cls === 'mic' || cls === 'camera';
    if (!isDevice && cls !== 'link') return;
    const node = document.createElement('div');
    node.className = `toast ${cls}`;
    const ico = cls === 'mic' ? svgIcon(e.type.endsWith('on') ? 'mic' : 'micOff') : cls === 'camera' ? svgIcon(e.type.endsWith('on') ? 'cam' : 'camOff') : '';
    node.innerHTML = `${ico}<span>${esc(eventText(e))}</span>`;
    el.toasts.prepend(node);
    while (el.toasts.children.length > 2) el.toasts.lastChild.remove();
    placeToasts();
    setTimeout(() => { node.classList.add('leaving'); setTimeout(() => { node.remove(); placeToasts(); }, 450); }, 4500);
  }

  // Put toasts in the first screen corner that covers no desktop icon (or its name).
  // If every corner is taken, they sit over the internet strip, which only hides company chips briefly.
  function placeToasts() {
    const zone = el.toasts;
    if (!zone.children.length) return;
    const W = el.screen.clientWidth;
    const H = el.screen.clientHeight;
    const w = zone.offsetWidth;
    const h = zone.offsetHeight;
    const top = el.internet.offsetHeight + 8;
    const bottom = H - 38 - 8 - h;
    const boxes = [];
    for (const icon of icons.values()) {
      if (!icon.slot || icon.node.hidden) continue;
      boxes.push({ x: icon.slot.x, y: icon.slot.y, w: icon.slot.width, h: icon.node.offsetHeight });
    }
    const free = (x, y) => !boxes.some((b) => x < b.x + b.w && b.x < x + w && y < b.y + b.h && b.y < y + h);
    const corners = [[W - 12 - w, bottom], [12, bottom], [W - 12 - w, top], [12, top]];
    const spot = corners.find(([x, y]) => free(x, y)) || [W - 12 - w, 6];
    zone.style.left = `${Math.round(spot[0])}px`;
    zone.style.top = `${Math.round(spot[1])}px`;
  }

  // ---------- demo spotlight: cycles through the most interesting things on screen ----------

  const SPOTLIGHT_MS = 6500;
  let spotlightTimer = 0;
  let spotlightIndex = 0;
  let spotlightCaption = null;

  function spotlightSteps() {
    const apps = [...icons.values()].filter((i) => i.slot && !i.node.hidden).map((i) => i.app);
    const onDesk = new Set(apps.map((a) => a.id));
    const nameOf = (id) => apps.find((a) => a.id === id)?.name || id;
    const steps = [];
    for (const a of apps) if (a.cam) steps.push({ id: a.id, text: `${a.name} is using your camera right now` });
    for (const a of apps) if (a.mic) steps.push({ id: a.id, text: `${a.name} is listening to your microphone right now` });
    const busiest = apps.filter((a) => a.companies).sort((a, b) => b.companies - a.companies)[0];
    if (busiest) {
      const countries = new Set(busiest.destinations.map((d) => d.country).filter(Boolean)).size;
      steps.push({ id: busiest.id, text: `${busiest.name} connected to endpoints attributed to ${busiest.companies} companies in ${countries} countr${countries === 1 ? 'y' : 'ies'}` });
    }
    const tracked = apps.find((a) => a.trackers);
    if (tracked) {
      const t = tracked.destinations.find((d) => d.tracker);
      steps.push({ id: tracked.id, text: `${tracked.name} talks to ${t.org}, a tracking / analytics company` });
    }
    const pairs = groupLinks(lastState ? (lastState.legacyLinks || lastState.links) : []).filter((l) => onDesk.has(l.from) && onDesk.has(l.to));
    const local = pairs.find((l) => l.kind === 'local' && l.active) || pairs.find((l) => l.kind === 'local');
    if (local) steps.push({ id: local.from, text: `${nameOf(local.from)} and ${nameOf(local.to)} talk directly, without leaving this PC` });
    const shared = pairs.filter((l) => l.kind === 'shared').sort((a, b) => b.vias.length - a.vias.length)[0];
    if (shared) steps.push({ id: shared.from, text: `${nameOf(shared.from)} and ${nameOf(shared.to)} both send data to ${shared.vias.slice(0, 2).join(' and ')}` });
    return steps;
  }

  function spotlightNext() {
    const steps = spotlightSteps();
    if (!steps.length) { showCaption('Nothing to spotlight yet: open an app and try again'); select(null); return; }
    const step = steps[spotlightIndex++ % steps.length];
    select(step.id, true);
    showCaption(step.text);
  }

  function showCaption(text) {
    if (!spotlightCaption) {
      spotlightCaption = document.createElement('div');
      spotlightCaption.className = 'spotlight-caption';
      el.screen.appendChild(spotlightCaption);
    }
    spotlightCaption.style.top = `${el.internet.offsetHeight + 10}px`;
    spotlightCaption.textContent = text;
    spotlightCaption.hidden = false;
    spotlightCaption.classList.remove('pop');
    void spotlightCaption.offsetWidth;
    spotlightCaption.classList.add('pop');
  }

  function toggleSpotlight(on = !spotlightTimer) {
    clearInterval(spotlightTimer);
    spotlightTimer = 0;
    $('spotlight-btn').classList.toggle('on', on);
    $('spotlight-btn').textContent = on ? 'Stop spotlight' : 'Demo spotlight';
    if (on) {
      spotlightIndex = 0;
      spotlightNext();
      spotlightTimer = setInterval(spotlightNext, SPOTLIGHT_MS);
    } else {
      if (spotlightCaption) spotlightCaption.hidden = true;
      select(null);
    }
  }

  // ---------- footnote ----------

  function renderFootnote(state) {
    const hidden = Number(el.desktop.dataset.hidden || 0);
    let html = 'Outbound shows which apps connect where and who owns each server. It can\'t read message contents, because they\'re encrypted.';
    if (hidden) html += ` ${hidden} more app${hidden === 1 ? '' : 's'} not shown.`;
    if (state.dnsCacheAvailable === false) html += ' <span class="admin">Run as administrator to see the exact website names apps ask for.</span>';
    if (el.footnote.dataset.html !== html) { el.footnote.innerHTML = html; el.footnote.dataset.html = html; }
  }

  // ---------- main update, once a second ----------

  function update(state) {
    lastState = state;
    const observed = new Set(state.links.map(({ kind }) => kind));
    const legend = [
      ['loopback', '---- --  Loopback'], ['parent', '--- . -  Parent process'],
      ['pipe', '. . . .  Named pipe'], ['udp', '-- -- -  UDP listener'],
      ['shared-company', '--- ---  Shared company'], ['shared-tracker', '.. ---   Shared tracker [!]'],
    ];
    const text = '-------  TCP endpoint\n' + legend.map(([kind, label]) => observed.has(kind) ? label : label + ' / none observed').join('\n');
    const wireLegend = $('wire-legend-body');
    if (wireLegend.dataset.model !== text) {
      wireLegend.dataset.model = text;
      wireLegend.replaceChildren(document.createTextNode('-------  TCP endpoint\n'), ...legend.map(([kind, label]) => {
        const line = document.createElement('span');
        line.classList.toggle('intel-muted', !observed.has(kind));
        line.textContent = label + (observed.has(kind) ? '' : ' / none observed') + '\n';
        return line;
      }));
    }
    const users = deviceUsers(state);
    renderDevice('mic', state.devices.mic, state);
    renderDevice('camera', state.devices.camera, state);
    renderOrgs(state);
    renderDesktop(state, users);
    renderWires(state);
    renderFeed(state);
    renderFootnote(state);
    if (selected) renderDetail();
    const t = new Date(state.at);
    el.clock.textContent = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    firstState = false;
  }

  function relayout() {
    fitLaptop();
    if (lastState) {
      gridKey = '';
      update(lastState);
    }
  }

  function start() {
    buildKeyboard();
    $('tray-mic').innerHTML = svgIcon('mic');
    $('tray-cam').innerHTML = svgIcon('cam');
    document.querySelector('#card-mic .device-icon').innerHTML = svgIcon('mic');
    document.querySelector('#card-cam .device-icon').innerHTML = svgIcon('cam');
    for (const id of ['show-out', 'show-local', 'show-shared']) $(id).addEventListener('change', applyToggles);
    applyToggles();
    el.screen.addEventListener('click', (e) => { if (!e.target.closest('.app')) select(null); });
    el.detail.addEventListener('click', (event) => {
      if (event.target.closest('[data-xray-globe]') && selected) Outbound.showAppOnGlobe?.(selected);
    });
    $('spotlight-btn').addEventListener('click', () => toggleSpotlight());
    document.addEventListener('keydown', (e) => {
      if (Outbound.view !== 'computer' || e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && (selected || spotlightTimer)) select(null);
      if (e.key === 's' || e.key === 'S') toggleSpotlight();
    });

    let resizeTimer = 0;
    new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 60); }).observe(el.stage);
    fitLaptop();

    Outbound.onState(update);
    Outbound.onEvent(toast);
    Outbound.onView(() => { runLoop(); if (Outbound.view === 'computer') relayout(); });
    document.addEventListener('visibilitychange', runLoop);
    runLoop();
  }

  start();
})();
