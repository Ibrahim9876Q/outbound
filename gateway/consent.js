const { randomInt } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { orgForHost } = require('../lib/orgs');
const { trackerDomain } = require('./dns');
const { Auth0Error } = require('./auth0');

class ConsentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createConsent({ fga, ciba, grantMinutes, catalogPath }) {
  // The catalog is labels only. FGA owns authorization and expiry.
  let catalog = new Set();
  if (fga && catalogPath) {
    try {
      const saved = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      catalog = new Set(saved.filter((domain) => typeof domain === 'string' && trackerDomain(domain) === domain));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Could not read the local tracker approval catalog.');
    }
  }

  const seen = new Set();
  const decisions = new Map();
  const revoking = new Set();
  const checks = new Map();
  const checkTimes = [];
  let pending = null;
  let grants = new Map();
  let freshness = fga ? 'loading' : 'unconfigured';
  let fgaError;
  let refresh;
  let nextRefresh = 0;
  let revision = 0;

  function saveLabel(domain) {
    if (catalog.has(domain)) return;
    const updated = new Set([...catalog, domain]);
    if (catalogPath) {
      fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
      const temp = catalogPath + '.tmp';
      fs.writeFileSync(temp, JSON.stringify([...updated]));
      fs.renameSync(temp, catalogPath);
    }
    catalog = updated;
  }

  function allowTracker(domain) {
    if (!fga || revoking.has(domain)) return false;
    if (checks.has(domain)) return checks.get(domain);
    const now = Date.now();
    while (checkTimes.length && now - checkTimes[0] >= 1000) checkTimes.shift();
    if (checkTimes.length >= 18) return false;
    checkTimes.push(now);
    const checkRevision = revision;
    const check = fga.check(domain)
      .then((allowed) => allowed && checkRevision === revision)
      .catch(() => false)
      .finally(() => checks.delete(domain));
    checks.set(domain, check);
    return check;
  }

  async function resolveRequest(request) {
    const { domain, code } = request;
    let source = 'FGA';
    try {
      if (await fga.check(domain)) return;
      source = 'CIBA';
      const auth = await ciba.start('Outbound ref ' + code);
      request.state = 'pending';
      request.expiresAt = auth.deadline;
      const result = await ciba.waitForDecision(auth);
      if (result !== 'approved') {
        decisions.set(domain, { state: result, requestCode: code });
        return;
      }
      request.state = 'saving';
      source = 'FGA';
      const expiresAt = Date.now() + grantMinutes * 60000;
      saveLabel(domain);
      await fga.grant(domain, expiresAt);
      revision++;
      grants.set(domain, expiresAt);
      decisions.delete(domain);
    } catch (error) {
      decisions.set(domain, { state: 'failed', requestCode: code, source,
        reason: error instanceof Auth0Error ? error.message : 'Could not complete the Auth0 request. Check the gateway connection and Auth0 setup.' });
    } finally {
      pending = null;
      nextRefresh = 0;
    }
  }

  function request(domain) {
    if (!fga || !ciba) throw new ConsentError(503, 'Configure Auth0 FGA and CIBA in .env first.');
    if (!seen.has(domain)) throw new ConsentError(404, 'This tracker has not been observed.');
    if (pending) throw new ConsentError(409, 'Respond to the current Guardian request first.');
    if (revoking.has(domain) || grants.get(domain) > Date.now()) {
      throw new ConsentError(409, 'This tracker already has an approval or is being revoked.');
    }
    pending = { domain, code: String(randomInt(100000, 1000000)), state: 'starting' };
    decisions.delete(domain);
    void resolveRequest(pending);
    return { ...pending };
  }

  async function revoke(domain) {
    if (!fga || (!catalog.has(domain) && !seen.has(domain))) throw new ConsentError(404, 'Tracker approval unavailable.');
    if (pending?.domain === domain || revoking.has(domain)) throw new ConsentError(409, 'This tracker already has an action in progress.');
    revoking.add(domain);
    revision++;
    try {
      await fga.revoke(domain);
      grants.delete(domain);
      decisions.set(domain, { state: 'revoked' });
    } catch (error) {
      throw new ConsentError(503, error instanceof Auth0Error ? error.message : 'FGA could not confirm revocation. Try again.');
    } finally {
      revision++;
      revoking.delete(domain);
      nextRefresh = 0;
    }
  }

  function refreshGrants() {
    if (!fga || refresh || nextRefresh > Date.now()) return;
    const currentRevision = revision;
    refresh = fga.list(new Set([...catalog, ...seen])).then((active) => {
      if (revision !== currentRevision) return;
      grants = active;
      freshness = 'ready';
      fgaError = undefined;
    }).catch((error) => {
      if (revision !== currentRevision) return;
      freshness = 'unavailable';
      fgaError = error instanceof Auth0Error ? error.message : 'Could not reach Auth0 FGA. Tracker lookups remain blocked if consent cannot be verified.';
    }).finally(() => {
      nextRefresh = revision === currentRevision ? Date.now() + 5000 : 0;
      refresh = undefined;
    });
  }

  function snapshot() {
    refreshGrants();
    const now = Date.now();
    const active = [...grants.keys()].filter((domain) => grants.get(domain) > now);
    const domains = new Set([...active, ...[...seen].reverse(), ...decisions.keys()]);
    const trackers = [...domains].map((domain) => {
      const base = { domain, org: orgForHost(domain) };
      const expiresAt = grants.get(domain);
      if (pending?.domain === domain) return { ...base, ...pending };
      if (revoking.has(domain)) return { ...base, state: 'revoking' };
      if (expiresAt > now) return { ...base, state: 'approved', expiresAt };
      return { ...base, ...decisions.get(domain), state: decisions.get(domain)?.state || 'blocked' };
    });
    return { fga: freshness, fgaError, ciba: Boolean(ciba), grantMinutes, active: active.length, pending: Boolean(pending), trackers };
  }

  return {
    allowTracker, request, revoke, snapshot, observe: (domain) => seen.add(domain),
    verify: async (domain) => {
      try { return Boolean(fga && await fga.check(domain)); }
      catch (error) {
        throw new ConsentError(503, error instanceof Auth0Error ? error.message : 'Could not reach Auth0 FGA to check consent.');
      }
    },
  };
}

module.exports = { createConsent, ConsentError };
