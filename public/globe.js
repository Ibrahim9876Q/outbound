(() => {
  const view = document.getElementById('view-globe');
  const mount = document.getElementById('globe');
  const countries = document.getElementById('countries');
  const filters = document.getElementById('app-filter');
  const tip = document.getElementById('globe-tip');
  const legend = view.querySelector('.globe-legend');
  const wrap = mount.parentElement;

  if (!document.querySelector('link[href$="globe.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/globe.css';
    document.head.append(stylesheet);
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const palette = [
    ['#ffb347', '#4cc9ff'],
    ['#ff8766', '#77b0ff'],
    ['#ffe17b', '#61e4df'],
    ['#ffa782', '#a8a9ff'],
    ['#ffc958', '#9be3ff'],
    ['#ff9eab', '#6df2b6'],
  ];
  const trackerColors = ['#ff4d6d', '#ff8093'];
  // The matching offline sprite is bundled in globe.css.
  const flagCodes = `
    AD AE AF AG AI AL AM AN AO AR AS AT AU AW AX AZ
    BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BV
    BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR
    CS CU CV CX CY CZ DE DJ DK DM DO DZ EC EE EG EH
    ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH
    GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR
    HT HU ID IE IL IN IO IQ IR IS IT JM JO JP KE KG
    KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS
    LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MP
    MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI
    NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN
    PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE
    SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
    TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
    UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
    YT ZA ZM ZW
  `.trim().split(/\s+/);
  const countryRows = new Map();
  const appButtons = new Map();
  const arcCache = new Map();
  let globe;
  let initFailed = false;
  let state;
  let selectedApp = null;
  let modelKey = '';
  let visible = false;
  let rotating = !reducedMotion.matches;
  let pinnedPoint = null;
  let shownPoint = null;

  const overview = node('div', 'globe-overview');
  const heading = node('h2', '', 'Connection map');
  const summary = node('p', '', 'Waiting for network activity…');
  overview.append(heading, summary);
  const motion = node('button', 'globe-motion');
  motion.type = 'button';
  motion.addEventListener('click', () => setRotation(!rotating));
  wrap.append(overview, motion);

  const legendLabels = ['Outbound route', 'Return route', 'Tracker / analytics'];
  [...legend.children].forEach((row, i) => {
    row.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) child.remove();
    });
    row.append(document.createTextNode(legendLabels[i]));
  });
  legend.append(node('p', '', 'Motion illustrates active TCP connections.'));
  tip.hidden = true;
  const countryNote = node('p', 'globe-card-note', 'App destinations, including recently closed connections.');
  countries.before(countryNote);
  const countryEmpty = node('p', 'globe-card-note', 'Waiting for destinations…');
  const filterEmpty = node('p', 'globe-card-note', 'Apps appear after connecting to a remote server.');
  countries.after(countryEmpty);
  filters.after(filterEmpty);
  setRotation(rotating);

  function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function hash(text) {
    let value = 0;
    for (const char of text) value = (Math.imul(31, value) + char.codePointAt(0)) >>> 0;
    return value;
  }

  function countryName(code) {
    return code ? regionNames.of(code) : 'Unknown country';
  }

  function hasCoordinates(place) {
    return Number.isFinite(place?.lat) && Math.abs(place.lat) <= 90
      && Number.isFinite(place?.lng) && Math.abs(place.lng) <= 180;
  }

  function countryCode(code) {
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }

  function countryFlag(code) {
    const index = flagCodes.indexOf(code);
    if (index < 0) return node('span', 'globe-flag', code || '—');
    const icon = node('span', 'globe-flag globe-flag-icon');
    const x = -(index % 16) * 16;
    const y = -Math.floor(index / 16) * 12;
    icon.style.backgroundPosition = x + 'px ' + y + 'px';
    return icon;
  }

  function plural(count, word) {
    return count === 1 ? word : word + 's';
  }

  function arcColor(hex, active) {
    const rgb = hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16));
    return 'rgba(' + rgb.join(',') + ',' + (active ? 0.88 : 0.3) + ')';
  }

  function reconcile(container, cache, items, key, create, update) {
    const remaining = new Set(cache.keys());
    let next = container.firstElementChild;
    for (const item of items) {
      const id = key(item);
      let element = cache.get(id);
      if (!element) {
        element = create(item);
        cache.set(id, element);
      }
      update(element, item);
      if (element !== next) container.insertBefore(element, next);
      next = element.nextElementSibling;
      remaining.delete(id);
    }
    for (const id of remaining) {
      cache.get(id).remove();
      cache.delete(id);
    }
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function renderFilters(apps) {
    const choices = [{ id: '', name: 'All apps' }, ...apps];
    reconcile(filters, appButtons, choices, (app) => app.id, (app) => {
      const button = node('button', 'globe-app');
      button.type = 'button';
      if (app.id) {
        const [out, inbound] = palette[hash(app.id) % palette.length];
        button.style.setProperty('--route-out', out);
        button.style.setProperty('--route-in', inbound);
      }
      button.addEventListener('click', () => {
        selectedApp = app.id || null;
        setRotation(false);
        render();
      });
      return button;
    }, (button, app) => {
      setText(button, app.name);
      const pressed = String((selectedApp || '') === app.id);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    });
    filterEmpty.hidden = apps.length > 0;
  }

  function renderCountries(places) {
    const totals = new Map();
    for (const place of places) {
      const code = place.country;
      totals.set(code, (totals.get(code) || 0) + 1);
    }
    const rows = [...totals].sort(([a, aCount], [b, bCount]) =>
      Number(!a) - Number(!b) || bCount - aCount || countryName(a).localeCompare(countryName(b)));
    reconcile(countries, countryRows, rows, ([code]) => code, ([code]) => {
      const row = node('li', 'globe-country');
      const icon = countryFlag(code);
      icon.setAttribute('aria-hidden', 'true');
      row.append(icon, node('span', 'globe-country-name', countryName(code)), node('span', 'globe-count'));
      return row;
    }, (row, [, count]) => setText(row.lastElementChild, String(count)));
    countryEmpty.hidden = rows.length > 0;
  }

  function makeArcs(places, home) {
    const next = new Map();
    for (const place of places) {
      const [out, inbound] = place.tracker ? trackerColors : palette[hash(place.appId) % palette.length];
      const spread = hash(place.id) % 10 / 100;
      for (const [direction, start, end, color, scale] of [
        ['out', home, place, out, 0.32],
        ['in', place, home, inbound, 0.22],
      ]) {
        const id = place.id + direction;
        const arc = arcCache.get(id) || {};
        Object.assign(arc, {
          startLat: start.lat, startLng: start.lng, endLat: end.lat, endLng: end.lng,
          startAlt: 0.004, endAlt: 0.004, scale: scale + spread,
          color: arcColor(color, place.active),
          active: place.active, duration: 3400 + hash(id) % 1200, phase: spread,
        });
        next.set(id, arc);
      }
    }
    arcCache.clear();
    for (const [id, arc] of next) arcCache.set(id, arc);
    return [...next.values()];
  }

  function makePoints(places, home) {
    const points = new Map();
    for (const place of places) {
      const key = place.lat + '|' + place.lng;
      if (!points.has(key)) {
        points.set(key, { key, lat: place.lat, lng: place.lng, places: [], sockets: 0 });
      }
      const point = points.get(key);
      point.places.push(place);
      if (place.active) point.sockets += place.sockets;
    }
    return [
      ...points.values(),
      { key: 'home', lat: home.lat, lng: home.lng, label: home.label || 'This PC' },
    ];
  }

  function renderPoint(point) {
    if (point === shownPoint) return;
    shownPoint = point;
    tip.replaceChildren();
    tip.hidden = !point;
    tip.classList.toggle('pinned', pinnedPoint !== null);
    if (!point) return;

    if (pinnedPoint !== null) {
      const close = node('button', 'globe-tip-close', '×');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close destination details');
      close.addEventListener('click', clearPoint);
      tip.append(close);
    }
    if (point.key === 'home') {
      tip.append(node('strong', '', point.label), node('p', '', 'Connections originate here.'));
      return;
    }

    const byOwner = new Map();
    for (const place of point.places) {
      const key = JSON.stringify([place.org, place.city, place.country, place.appName, place.tracker]);
      byOwner.set(key, place);
    }
    const details = [...byOwner.values()];
    for (const place of details.slice(0, pinnedPoint === null ? 4 : details.length)) {
      const row = node('div', 'globe-tip-row');
      const title = node('strong', '', place.org);
      if (place.tracker) title.append(node('span', 'globe-tracker', 'Tracker'));
      const location = [place.city, countryName(place.country)].filter(Boolean).join(', ');
      row.append(title, node('p', '', place.appName + ' · ' + location));
      tip.append(row);
    }
    if (pinnedPoint === null && details.length > 4) {
      tip.append(node('p', '', 'Select the point to see all ' + details.length + ' entries.'));
    }
  }

  function clearPoint() {
    pinnedPoint = null;
    renderPoint(null);
  }

  function render() {
    if (!visible || !state) return;
    const apps = state.apps.filter((app) => app.destinations.length).sort((a, b) =>
      a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    if (!apps.some((app) => app.id === selectedApp)) selectedApp = null;
    const places = apps.filter((app) => selectedApp === null || app.id === selectedApp)
      .flatMap((app) => app.destinations.map((destination) => ({
        id: app.id + '|' + destination.ip, appId: app.id, appName: app.name,
        org: destination.org || 'Unknown owner', city: destination.city,
        country: countryCode(destination.country), lat: destination.lat, lng: destination.lng,
        active: destination.active, sockets: destination.sockets || 0, tracker: destination.tracker,
      }))).sort((a, b) => a.id.localeCompare(b.id));
    const key = JSON.stringify([apps.map(({ id, name }) => [id, name]), selectedApp, state.home, places]);
    if (key === modelKey) return;
    modelKey = key;
    renderFilters(apps);
    renderCountries(places);
    const home = state.home;
    const located = hasCoordinates(home) ? places.filter(hasCoordinates) : [];
    if (!initFailed) {
      const count = located.length;
      const unknown = places.length - count;
      const mapped = count + ' mapped ' + plural(count, 'destination');
      setText(summary, places.length ? mapped + (unknown ? ' · ' + unknown + ' unplaced' : '') : 'Waiting for network activity…');
    }
    if (!globe) return;
    const points = hasCoordinates(home) ? makePoints(located, home) : [];
    if (shownPoint) {
      const updated = points.find((point) => point.key === shownPoint.key);
      if (updated) renderPoint(updated);
      else clearPoint();
    }
    globe.arcsData(makeArcs(located, home)).pointsData(points);
  }

  function setRotation(enabled) {
    rotating = enabled;
    if (globe) globe.controls().autoRotate = enabled;
    motion.textContent = enabled ? 'Pause rotation' : 'Resume rotation';
  }

  function initGlobe() {
    try {
      globe = new window.Globe(mount, { rendererConfig: { antialias: true, alpha: true } })
        .globeImageUrl('/vendor/earth-night.jpg')
        .backgroundImageUrl('/vendor/night-sky.png')
        .backgroundColor('#070b16')
        .atmosphereColor('#4c8de1')
        .atmosphereAltitude(0.17)
        .arcAltitudeAutoScale('scale')
        .arcStartAltitude('startAlt')
        .arcEndAltitude('endAlt')
        .arcColor('color')
        .arcCurveResolution(40)
        .arcDashLength((arc) => arc.active && !reducedMotion.matches ? 0.65 : 1)
        .arcDashGap((arc) => arc.active && !reducedMotion.matches ? 0.22 : 0)
        .arcDashInitialGap('phase')
        .arcDashAnimateTime((arc) => arc.active && !reducedMotion.matches ? arc.duration : 0)
        .arcsTransitionDuration(0)
        .pointAltitude((point) => point.key === 'home' ? 0.022 : 0.008)
        .pointRadius((point) => point.key === 'home' ? 0.65 : Math.min(1.4, 0.26 + Math.sqrt(point.sockets) * 0.16))
        .pointColor((point) => {
          if (point.key === 'home') return '#eefaff';
          if (point.places.some((place) => place.tracker)) return '#ff4d6d';
          return point.sockets ? '#7ce7ff' : '#6c8aab';
        })
        .pointResolution(10)
        .pointsTransitionDuration(0)
        .pointerEventsFilter((object) => object.__globeObjType !== 'arc')
        .onPointHover((point) => {
          if (pinnedPoint === null) renderPoint(point);
        })
        .onPointClick((point) => {
          setRotation(false);
          pinnedPoint = point.key;
          shownPoint = null;
          renderPoint(point);
        })
        .onGlobeClick(clearPoint);

      const controls = globe.controls();
      controls.autoRotateSpeed = 0.27;
      controls.enablePan = false;
      controls.minDistance = 125;
      controls.maxDistance = 530;
      setRotation(rotating);
      const home = hasCoordinates(state?.home) ? state.home : { lat: 43, lng: -81 };
      globe.pointOfView({ lat: home.lat - 9, lng: home.lng + 28, altitude: 1.85 });
      globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } catch (error) {
      globe = undefined;
      initFailed = true;
      motion.hidden = true;
      setText(summary, 'The 3D map requires WebGL. Destinations are listed alongside it.');
      console.warn('Outbound could not initialize the globe.', error);
    }
  }

  function syncView() {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    const nextVisible = !view.classList.contains('hidden') && !document.hidden && width > 0 && height > 0;
    if (!nextVisible) {
      if (visible) {
        globe?.pauseAnimation();
        clearPoint();
      }
      visible = false;
      return;
    }
    if (!globe && !initFailed) initGlobe();
    if (globe) {
      if (globe.width() !== width) globe.width(width);
      if (globe.height() !== height) globe.height(height);
      if (!visible) globe.resumeAnimation();
    }
    visible = true;
    render();
  }

  function receiveState(snapshot) {
    state = snapshot;
    render();
  }

  mount.addEventListener('pointerdown', () => setRotation(false));
  mount.addEventListener('wheel', () => setRotation(false), { passive: true });
  view.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clearPoint();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) setRotation(false);
    modelKey = '';
    render();
  });
  new ResizeObserver(syncView).observe(mount);
  new MutationObserver(syncView).observe(view, { attributes: true, attributeFilter: ['class', 'hidden'] });
  document.addEventListener('visibilitychange', syncView);

  if (typeof window.Outbound?.subscribeState === 'function') {
    window.Outbound.subscribeState(receiveState);
  } else {
    const source = new EventSource('/events');
    source.addEventListener('state', (event) => receiveState(JSON.parse(event.data)));
  }
  syncView();
})();
