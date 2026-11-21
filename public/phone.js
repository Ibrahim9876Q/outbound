(() => {
  const byId = (id) => document.getElementById('phone-' + id);
  if (!byId('title')) return;

  const filter = byId('filter');
  const number = new Intl.NumberFormat();
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const types = { 1: 'A', 5: 'CNAME', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 64: 'SVCB', 65: 'HTTPS' };
  const outcomes = { blocked: 'Blocked', approved: 'Approved', forwarded: 'Forwarded', unresolved: 'No answer', error: 'Resolver error' };
  const trackerStatuses = {
    blocked: ['Blocked', 'blocked'],
    approved: ['Approved', 'approved'],
    starting: ['Contacting Auth0', 'pending'],
    pending: ['Waiting for Guardian', 'pending'],
    saving: ['Saving approval', 'pending'],
    denied: ['Denied', 'blocked'],
    revoked: ['Revoked', 'blocked'],
    revoking: ['Revoking', 'pending'],
    expired: ['Request expired', 'blocked'],
    failed: ['Request failed', 'error'],
  };
  let state;
  let feedKey;
  let trackersKey;
  let busy = false;

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
      host.append(node('small', 'Tracker · ' + lookup.tracker));
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

  function trackerRow(tracker, consent) {
    const item = node('li', null, 'phone-tracker');
    const name = node('div');
    name.append(node('span', tracker.domain, 'phone-domain'));
    if (tracker.org) name.append(node('small', tracker.org));
    if (tracker.code) name.append(node('small', 'Match Outbound ref ' + tracker.code + ' in Guardian.'));
    if (tracker.state === 'approved') {
      name.append(node('small', 'Expires at ' + time.format(tracker.expiresAt)));
    }
    if (tracker.reason) name.append(node('small', tracker.reason));
    const actions = node('div', null, 'phone-tracker-actions');
    actions.append(status(...trackerStatuses[tracker.state]));
    const revoke = tracker.state === 'approved';
    const request = ['blocked', 'revoked', 'expired', 'failed', 'denied'].includes(tracker.state);
    if (revoke || (request && consent.ciba && consent.fga !== 'unconfigured')) {
      const button = node('button', revoke ? 'Revoke' : 'Ask Guardian', 'phone-button');
      button.type = 'button';
      button.dataset.domain = tracker.domain;
      button.dataset.action = revoke ? 'revoke' : 'request';
      button.disabled = busy || (!revoke && (consent.pending || consent.fga === 'unavailable'));
      button.setAttribute('aria-label', button.textContent + ' for ' + tracker.domain);
      actions.append(button);
    }
    item.append(name, actions);
    return item;
  }

  function authMessage(consent) {
    if (consent.fga === 'unconfigured') return 'Known trackers are blocked. Configure Auth0 FGA and CIBA to request access.';
    if (consent.fga === 'unavailable') return 'FGA is unavailable. New tracker lookups stay blocked if an approval can’t be verified.';
    if (!consent.ciba) return 'Configure Auth0 CIBA to send approval requests to Guardian.';
    return 'Ask Guardian to approve a tracker for ' + number.format(consent.grantMinutes) +
      (consent.grantMinutes === 1 ? ' minute.' : ' minutes.');
  }

  function render() {
    const { dns, stats, consent } = state;
    const gatewayStatus = byId('status');
    gatewayStatus.textContent = dns.host === '127.0.0.1' ? 'Loopback DNS listening' : 'Phone DNS listening';
    gatewayStatus.dataset.live = 'true';
    byId('endpoint').textContent = dns.host + ':' + dns.port;
    byId('lookups').textContent = number.format(stats.lookups);
    byId('blocked').textContent = number.format(stats.blocked);
    byId('approved').textContent = ['unavailable', 'loading'].includes(consent.fga) ? '—' : number.format(consent.active);
    byId('auth-status').textContent = authMessage(consent);
    renderFeed();
    const key = JSON.stringify([consent, busy]);
    if (key !== trackersKey) {
      trackersKey = key;
      const list = byId('trackers');
      const focus = list.contains(document.activeElement) ? document.activeElement?.dataset.domain : null;
      list.replaceChildren(...consent.trackers.map((tracker) => trackerRow(tracker, consent)));
      if (focus) [...list.querySelectorAll('button')].find((button) => button.dataset.domain === focus)?.focus();
      byId('trackers-empty').hidden = consent.trackers.length > 0;
    }
  }

  async function changeConsent(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || busy) return;
    const { domain, action } = button.dataset;
    const message = byId('action-status');
    message.hidden = false;
    message.textContent = action === 'request' ? 'Preparing Guardian request…' : 'Revoking approval…';
    busy = true;
    render();
    try {
      const response = await fetch('/api/trackers/' + encodeURIComponent(domain) + '/' + action, {
        method: 'POST', headers: { 'X-Outbound-Action': '1' }, signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      message.textContent = action === 'request' ? 'Check the request below for ' + domain + '.' : 'Revoked approval for ' + domain + '.';
    } catch (error) {
      message.textContent = error.name === 'Error' ? error.message : 'Could not reach the gateway.';
    } finally {
      busy = false;
      render();
      [...byId('trackers').querySelectorAll('button')].find((next) => next.dataset.domain === domain)?.focus();
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
  byId('trackers').addEventListener('click', changeConsent);
  void poll();
})();
