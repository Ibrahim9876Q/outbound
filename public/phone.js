(() => {
  const byId = (id) => document.getElementById('phone-' + id);
  if (!byId('title')) return;

  const filter = byId('filter');
  const number = new Intl.NumberFormat();
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const types = { 1: 'A', 5: 'CNAME', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 64: 'SVCB', 65: 'HTTPS' };
  const outcomes = { blocked: 'Blocked', approved: 'Approved', forwarded: 'Forwarded', unresolved: 'No answer', error: 'Resolver error' };
  let state;
  let feedKey;
  let trackersKey;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function status(text, kind) {
    return node('span', text, 'phone-badge phone-badge--' + kind);
  }

  function lookupRow(lookup) {
    const row = node('tr');
    const detail = [lookup.org, types[lookup.type] || 'Type ' + lookup.type].filter(Boolean).join(' · ');
    const host = node('th');
    host.scope = 'row';
    host.append(node('span', lookup.host, 'phone-domain'), node('small', detail));
    if (lookup.tracker && lookup.host !== lookup.tracker) {
      host.append(node('small', 'Tracker: ' + lookup.tracker));
    }
    const outcome = node('td');
    outcome.append(status(outcomes[lookup.status], lookup.status));
    row.append(host, outcome, node('td', time.format(lookup.at), 'phone-time'));
    return row;
  }

  function renderFeed() {
    if (!state) return;
    const key = String(state.lookups[0]?.id) + ':' + filter.checked;
    if (key === feedKey) return;
    feedKey = key;
    const events = state.lookups.filter((lookup) => !filter.checked || lookup.tracker);
    byId('feed').replaceChildren(...events.slice(0, 35).map(lookupRow));
    const empty = byId('feed-empty');
    empty.hidden = events.length > 0;
    empty.textContent = filter.checked ? 'No tracker lookups in the recent feed.' : 'Waiting for the first lookup.';
  }

  function trackerRow(tracker) {
    const item = node('li', null, 'phone-tracker');
    const name = node('div');
    name.append(node('span', tracker.domain, 'phone-domain'));
    if (tracker.org) name.append(node('small', tracker.org));
    item.append(name, status('Blocked', 'blocked'));
    return item;
  }

  function render() {
    const { dns, stats, trackers } = state;
    const gatewayStatus = byId('status');
    gatewayStatus.textContent = dns.host === '127.0.0.1' ? 'Loopback DNS listening' : 'Phone DNS listening';
    gatewayStatus.dataset.live = 'true';
    byId('endpoint').textContent = dns.host + ':' + dns.port;
    byId('lookups').textContent = number.format(stats.lookups);
    byId('blocked').textContent = number.format(stats.blocked);
    byId('approved').textContent = '0';
    renderFeed();
    const key = trackers.map((tracker) => tracker.domain).join('|');
    if (key !== trackersKey) {
      trackersKey = key;
      byId('trackers').replaceChildren(...trackers.map(trackerRow));
      byId('trackers-empty').hidden = trackers.length > 0;
    }
  }

  async function poll() {
    try {
      const response = await fetch('/api/state', { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error('Gateway unavailable');
      const next = await response.json();
      if (state && next.stats.lookups < state.stats.lookups) feedKey = undefined;
      state = next;
      render();
    } catch {
      byId('status').textContent = 'Gateway unavailable';
      byId('status').dataset.live = 'false';
    } finally {
      setTimeout(poll, 1000);
    }
  }

  filter.addEventListener('change', renderFeed);
  void poll();
})();
