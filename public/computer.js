// Computer view: a drawn laptop whose screen is a desktop of the apps using the network, with wires
// showing where each app sends data, plus the live webcam LED and mic key.
(function () {
  'use strict';

  const { esc, flagHtml, countryName, ago, duration, initials, appColor, appLabel, deviceAppName, deviceUsers, eventText, svgIcon } = Outbound.util;
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

  const ICON_W = 108;  // .app width in computer.css
  const TILE_TOP = 6;  // .app padding-top
  const TILE = 56;     // .tile size
  const SLOT_W = 116;
  const SLOT_H = 112;
  const MAX_IDLE_LABELS = 4;  // "both → X" labels shown when no app is selected
  const FRESH_MS = 90 * 1000; // apps that just started talking get priority for a desktop spot

  let lastState = null;
  let selected = null;       // selected app id
  let firstState = true;

  // ---------- keyboard ----------

  // [label, width, id] — the function row holds the mic-mute and camera keys like a real laptop.
  const KEY_ROWS = [
    { cls: 'fn', keys: [['esc', 1], ['F1', 1], ['F2', 1], ['F3', 1], ['mic', 1, 'key-mic'], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['cam', 1, 'key-cam'], ['F10', 1], ['F11', 1], ['F12', 1], ['del', 1]] },
    { keys: [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['⌫', 1.9]] },
    { keys: [['tab', 1.5], ...'QWERTYUIOP[]'.split('').map((k) => [k, 1]), ['\\', 1.4]] },
    { keys: [['caps', 1.8], ...'ASDFGHJKL;\''.split('').map((k) => [k, 1]), ['enter', 2.1]] },
    { keys: [['shift', 2.3], ...'ZXCVBNM,./'.split('').map((k) => [k, 1]), ['shift', 2.6]] },
    { keys: [['ctrl', 1.2], ['fn', 1], ['⊞', 1], ['alt', 1.2], ['', 6.2], ['alt', 1.2], ['ctrl', 1.2], ['◂', 1], ['▴▾', 1], ['▸', 1]] },
  ];

  function buildKeyboard() {
    el.keyboard.innerHTML = KEY_ROWS.map((row) => `<div class="krow ${row.cls || ''}">${row.keys.map(([label, w, id]) => {
      if (id === 'key-mic') return `<div class="key hero" id="key-mic" style="--w:${w}" title="Microphone">${svgIcon('micOff')}<small>muted</small></div>`;
      if (id === 'key-cam') return `<div class="key hero" id="key-cam" style="--w:${w}" title="Camera">${svgIcon('camOff')}<small>off</small></div>`;
      return `<div class="key" style="--w:${w}">${esc(label)}</div>`;
    }).join('')}</div>`).join('');
  }

  // ---------- fit the laptop to the window ----------

  function fitLaptop() {
    const stage = el.stage;
    const cs = getComputedStyle(stage);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.rowGap) || 0;
    const availW = stage.clientWidth - padX - 16;
    const availH = stage.clientHeight - padY - el.toggles.offsetHeight - el.footnote.offsetHeight - gap * 2 - 8;
    // Everything in the laptop scales with its width, so measure its shape once and scale to fit.
    for (let pass = 0; pass < 2; pass++) {
      const w0 = el.laptop.offsetWidth;
      const baseRect = el.base.getBoundingClientRect();
      const visualH = el.lid.offsetHeight + baseRect.height;
      const visualW = Math.max(w0, baseRect.width);
      const w = Math.max(420, Math.floor(Math.min(availW * w0 / visualW, availH * w0 / visualH, 1500)));
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
      key.innerHTML = isMic
        ? `${svgIcon(dev.active ? 'mic' : 'micOff')}<small>${dev.active ? 'live' : 'muted'}</small>`
        : `${svgIcon(dev.active ? 'cam' : 'camOff')}<small>${dev.active ? 'on' : 'off'}</small>`;
    }

    const caption = $(isMic ? 'mic-caption' : 'cam-caption');
    caption.classList.toggle('on', dev.active);
    caption.textContent = dev.active
      ? `${who} is using your ${isMic ? 'microphone' : 'camera'}`
      : (isMic ? 'Microphone muted' : 'Camera off');

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

  function buildSlots() {
    const W = el.screen.clientWidth;
    const H = el.screen.clientHeight;
    const top = el.internet.offsetHeight + 52;
    const bottom = H - 38 - 8;
    const left = 14, right = W - 14;
    const cols = Math.max(1, Math.floor((right - left) / SLOT_W));
    const rows = Math.max(1, Math.floor((bottom - top) / SLOT_H));
    const key = `${cols}x${rows}@${top}`;
    if (key === gridKey) return false;
    gridKey = key;
    const cellW = (right - left) / cols;
    const cellH = (bottom - top) / rows;
    const focus = { x: W / 2, y: top + (bottom - top) * 0.45 };
    slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = left + c * cellW + (cellW - ICON_W) / 2;
      const y = top + r * cellH + (cellH - SLOT_H) / 2 + 4;
      const cx = x + ICON_W / 2, cy = y + SLOT_H / 2;
      // Fill from the middle outward, preferring wide rows over tall columns.
      slots.push({ x, y, taken: null, rank: Math.abs(cx - focus.x) / W + Math.abs(cy - focus.y) / H * 1.6 });
    }
    slots.sort((a, b) => a.rank - b.rank);
    return true;
  }

  // Apps shown on the desktop: any with network activity, plus anything using the mic or camera.
  function desktopApps(state, users) {
    const list = state.apps.map((a) => ({ ...a, name: appLabel(a.name), mic: users.mic.has(a.id), cam: users.camera.has(a.id) }));
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
      const unknown = /^pid-\d+/i.test(a.id);
      const fresh = !unknown && now - born < FRESH_MS;
      a.priority = (a.mic || a.cam ? 1e6 : 0) + (fresh ? 1e4 : 0) + (unknown ? 0 : 1e3) + a.activeConnections * 10 + a.destinations.length;
    }
    return list.sort((a, b) => b.priority - a.priority);
  }

  function renderDesktop(state, users) {
    const apps = desktopApps(state, users);
    if (buildSlots()) {
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
        if (!firstState) icon.node.classList.add('entering');
      }
      icon.app = app;
      if (!icon.slot) {
        const free = slots.find((s) => !s.taken) || evictFor(app);
        if (free) { free.taken = app.id; icon.slot = free; }
      }
      if (!icon.slot) { icon.node.hidden = true; hiddenApps++; continue; }
      icon.node.hidden = false;
      if (!icon.node.isConnected) el.desktop.appendChild(icon.node);
      icon.node.style.transform = `translate(${Math.round(icon.slot.x)}px, ${Math.round(icon.slot.y)}px)`;
      updateIcon(icon.node, app);
    }
    el.empty.hidden = apps.length > 0;
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

  function tileInner(app) {
    return app.icon
      ? `<img alt="" src="data:image/png;base64,${app.icon}">`
      : `<span class="initials">${esc(initials(app.name))}</span>`;
  }

  function makeIcon(app) {
    const node = document.createElement('div');
    node.className = 'app';
    node.dataset.id = app.id;
    node.innerHTML = `<div class="tile">${tileInner(app)}<span class="badge tr" hidden></span><span class="badge co" hidden></span><span class="badge dev" hidden></span></div><div class="name"></div>`;
    if (!app.icon) node.querySelector('.tile').style.background = `linear-gradient(160deg, ${appColor(app.id, 48)}, ${appColor(app.id, 30)})`;
    node.addEventListener('click', (e) => { e.stopPropagation(); select(selected === app.id ? null : app.id); });
    return node;
  }

  function updateIcon(node, app) {
    const name = node.querySelector('.name');
    if (name.textContent !== app.name) name.textContent = app.name;
    if (app.icon && !node.querySelector('img')) {
      // The real icon arrived after the app first appeared.
      node.querySelector('.initials')?.remove();
      const tile = node.querySelector('.tile');
      tile.style.background = '';
      tile.insertAdjacentHTML('afterbegin', tileInner(app));
    }
    const co = node.querySelector('.badge.co');
    co.hidden = !app.companies;
    co.textContent = app.companies;
    const tr = node.querySelector('.badge.tr');
    tr.hidden = !app.trackers;
    tr.textContent = app.trackers;
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
  }

  function isRelated(id) {
    if (!selected || !lastState) return false;
    return lastState.links.some((l) => (l.from === selected && l.to === id) || (l.to === selected && l.from === id));
  }

  // Positions on the screen, from the icon's slot.
  function iconPoint(id, where) {
    const icon = icons.get(id);
    if (!icon || !icon.slot || icon.node.hidden) return null;
    const x = icon.slot.x + ICON_W / 2;
    if (where === 'top') return { x, y: icon.slot.y + TILE_TOP };
    if (where === 'bottom') return { x, y: icon.slot.y + TILE_TOP + TILE + 40 };
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
    return specs;
  }

  // Hosting / CDN / OS companies nearly every app touches. Two apps "both using Cloudflare" is plumbing,
  // not a story, so these shared links only appear when one of the two apps is selected.
  const INFRA_ORG = /cloudflare|akamai|fastly|amazon web services|cloudfront|google cloud|azure|^microsoft$|digitalocean|vultr|ovh|hetzner|linode|oracle|edgio|edgecast|lumen|level 3|unknown owner/i;

  // One wire per pair of apps: shared links list every company the pair has in common.
  function groupLinks(links) {
    const pairs = new Map();
    for (const link of links) {
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
      const nameH = icon.node.querySelector('.name').offsetHeight;
      boxes.push({ x: icon.slot.x + 6, y: icon.slot.y, w: ICON_W - 12, h: TILE_TOP + TILE + 6 + nameH });
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
    const dur = w.kind === 'local' ? 0.9 + Math.random() * 0.3 : 1.2 + Math.random() * 0.7;
    packets.push({ wire: w, t: 0, dur, dir, node });
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    const show = { out: $('show-out').checked, local: $('show-local').checked };
    if (!reducedMotion.matches) {
      for (const w of wires.values()) {
        if (!w.rate || !show[w.kind] || !wires.has(w.path.dataset.key)) continue;
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
      const t = p.dir > 0 ? p.t : 1 - p.t;
      const pt = bezier(p.wire.pts, t);
      p.node.setAttribute('cx', pt.x.toFixed(1));
      p.node.setAttribute('cy', pt.y.toFixed(1));
      p.node.setAttribute('opacity', Math.min(1, p.t * 8, (1 - p.t) * 6).toFixed(2));
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
    if (!icon) { el.detail.innerHTML = ''; return; }
    const app = icon.app;
    const tile = app.icon ? tileInner(app) : `<span class="initials">${esc(initials(app.name))}</span>`;
    const tileStyle = app.icon ? '' : ` style="background:linear-gradient(160deg, ${appColor(app.id, 48)}, ${appColor(app.id, 30)})"`;
    const live = app.destinations.filter((d) => d.active).length;
    const dev = [app.mic && 'using the microphone', app.cam && 'using the camera'].filter(Boolean);
    let html = `<div class="detail-head"><div class="tile"${tileStyle}>${tile}</div><div><h3>${esc(app.name)}</h3>`
      + `<p>${app.companies} compan${app.companies === 1 ? 'y' : 'ies'} · ${live} live of ${app.destinations.length} servers${app.trackers ? ` · <span style="color:var(--tracker)">${app.trackers} tracker</span>` : ''}${dev.length ? ` · ${dev.join(', ')}` : ''}</p></div></div>`;
    if (app.destinations.length) {
      html += '<div class="detail-sub">Sends data to</div><ul class="dests">';
      html += app.destinations.slice(0, 40).map((d) => {
        const where = [d.city, d.country ? countryName(d.country) : null].filter(Boolean).join(', ') || 'Unknown location';
        const host = d.host ? `<code>${esc(d.host)}</code>` : `<code>${esc(d.ip)}</code>`;
        const ports = d.ports && d.ports.length ? ` · port ${d.ports.slice(0, 4).join(', ')}` : '';
        return `<li class="dest"><span class="live ${d.active ? 'on' : ''}" title="${d.active ? 'Connected now' : 'Closed'}"></span>`
          + `<span class="org-name">${esc(d.org)} ${d.tracker ? '<span class="tag tracker">tracker</span>' : ''}</span>`
          + `<span class="meta">${host}<br>${flagHtml(d.country)} ${esc(where)}${ports}${d.active ? '' : ' · closed'}</span></li>`;
      }).join('');
      html += '</ul>';
    }
    if (app.localPeers && app.localPeers.length) {
      html += '<div class="detail-sub">Talks directly to (on this PC)</div>';
      html += [...new Set(app.localPeers)].map((id) => {
        const peer = lastState.apps.find((a) => a.id === id);
        const link = lastState.links.find((l) => l.kind === 'local' && ((l.from === id && l.to === app.id) || (l.to === id && l.from === app.id)));
        return `<div class="peer"><span class="sw local"></span>${esc(appLabel(peer ? peer.name : id))}${link && link.ports.length ? ` <span class="hint">· port ${link.ports.slice(0, 3).join(', ')}</span>` : ''}</div>`;
      }).join('');
    }
    const shared = lastState.links.filter((l) => l.kind === 'shared' && (l.from === app.id || l.to === app.id));
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

  // ---------- live feed + toasts ----------

  const feedItems = new Map(); // key -> li

  function eventKey(e) { return `${e.at}|${e.type}|${e.app || e.from}|${e.org || e.to || ''}|${e.host || ''}`; }

  function eventClass(e) {
    if (e.type.startsWith('mic')) return 'mic';
    if (e.type.startsWith('camera')) return 'camera';
    if (e.type === 'new-link') return 'link';
    return e.tracker ? 'tracker' : '';
  }

  function renderFeed(state) {
    const now = Date.now();
    const events = state.events.slice(0, 40);
    if (!events.length) {
      if (!el.feed.querySelector('.none')) el.feed.innerHTML = '<li class="none">Nothing yet. Open an app or a website and watch it appear here.</li>';
      return;
    }
    el.feed.querySelector('.none')?.remove();
    const keys = new Set();
    let anchor = el.feed.firstChild;
    for (const e of events) {
      const key = eventKey(e);
      keys.add(key);
      let li = feedItems.get(key);
      if (!li) {
        li = document.createElement('li');
        li.className = eventClass(e) + (firstState ? '' : ' fresh');
        li.innerHTML = `<span class="dot"></span><span>${esc(eventText(e))}</span><span class="t"></span>`;
        feedItems.set(key, li);
        el.feed.insertBefore(li, anchor);
      } else {
        anchor = li.nextSibling;
      }
      const t = li.querySelector('.t');
      const when = ago(e.at, now);
      if (t.textContent !== when) t.textContent = when;
    }
    for (const [key, li] of feedItems) if (!keys.has(key)) { li.remove(); feedItems.delete(key); }
  }

  function toast(e) {
    const cls = eventClass(e);
    const isDevice = cls === 'mic' || cls === 'camera';
    if (!isDevice && cls !== 'tracker' && cls !== 'link') return;
    const node = document.createElement('div');
    node.className = `toast ${cls}`;
    const ico = cls === 'mic' ? svgIcon(e.type.endsWith('on') ? 'mic' : 'micOff') : cls === 'camera' ? svgIcon(e.type.endsWith('on') ? 'cam' : 'camOff') : '';
    node.innerHTML = `${ico}<span>${esc(eventText(e))}</span>`;
    el.toasts.prepend(node);
    while (el.toasts.children.length > 3) el.toasts.lastChild.remove();
    setTimeout(() => { node.classList.add('leaving'); setTimeout(() => node.remove(), 450); }, 4500);
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
      steps.push({ id: busiest.id, text: `${busiest.name} sends data to ${busiest.companies} companies in ${countries} countr${countries === 1 ? 'y' : 'ies'}` });
    }
    const tracked = apps.find((a) => a.trackers);
    if (tracked) {
      const t = tracked.destinations.find((d) => d.tracker);
      steps.push({ id: tracked.id, text: `${tracked.name} talks to ${t.org}, a tracking / analytics company` });
    }
    const pairs = groupLinks(lastState ? lastState.links : []).filter((l) => onDesk.has(l.from) && onDesk.has(l.to));
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
