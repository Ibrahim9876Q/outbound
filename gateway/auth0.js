const { createHmac, createPublicKey, verify } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

const FGA_TOKEN_URL = 'https://auth.fga.dev/oauth/token';
const CONSISTENCY = 'HIGHER_CONSISTENCY';
const RELATION = 'can_resolve';
const CIBA_GRANT = 'urn:openid:params:grant-type:ciba';

function createFga(config, fetch = globalThis.fetch) {
  const url = config.api + 'stores/' + config.store;
  const digest = (value) => createHmac('sha256', config.key).update(value).digest('hex');
  const user = 'user:' + digest('user:' + config.subject);
  const objectFor = (domain) => 'tracker:' + digest('tracker:' + domain);
  const tuple = (object) => ({ user, relation: RELATION, object });
  let token;
  let tokenRequest;

  async function requestToken() {
    const response = await fetch(FGA_TOKEN_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3500),
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        audience: config.api,
      }),
    });
    if (!response.ok) throw new Error('FGA token request failed (HTTP ' + response.status + ').');
    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in)) {
      throw new Error('Invalid FGA token response.');
    }
    token = { value: data.access_token, refreshAt: Date.now() + Math.max(0, data.expires_in - 30) * 1000 };
    return token;
  }

  async function call(endpoint, body) {
    if (!token || token.refreshAt <= Date.now()) {
      tokenRequest ??= requestToken().finally(() => { tokenRequest = undefined; });
      await tokenRequest;
    }
    const usedToken = token;
    const response = await fetch(url + '/' + endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3500),
      headers: { Authorization: 'Bearer ' + usedToken.value, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 401 && token === usedToken) token = undefined;
    if (!response.ok) throw new Error('FGA ' + endpoint + ' failed (HTTP ' + response.status + ').');
    return response.status === 204 ? {} : response.json();
  }

  async function read(object, continuationToken = '') {
    const result = await call('read', {
      tuple_key: tuple(object), consistency: CONSISTENCY, page_size: 100,
      continuation_token: continuationToken,
    });
    if (!Array.isArray(result.tuples)) throw new Error('Invalid FGA read response.');
    return result;
  }

  async function revoke(domain) {
    const key = tuple(objectFor(domain));
    if (!(await read(key.object)).tuples.length) return;
    await call('write', { authorization_model_id: config.model, deletes: { tuple_keys: [key] } });
  }

  return {
    async check(domain) {
      const result = await call('check', {
        authorization_model_id: config.model, tuple_key: tuple(objectFor(domain)), consistency: CONSISTENCY,
        context: { current_time: new Date().toISOString() },
      });
      if (typeof result.allowed !== 'boolean') throw new Error('Invalid FGA check response.');
      return result.allowed;
    },
    async grant(domain, expiresAt) {
      await revoke(domain);
      await call('write', {
        authorization_model_id: config.model,
        writes: { tuple_keys: [{
          ...tuple(objectFor(domain)),
          condition: { name: 'unexpired', context: { expires_at: new Date(expiresAt).toISOString() } },
        }] },
      });
    },
    revoke,
    async list(domains) {
      const byObject = new Map([...domains].map((domain) => [objectFor(domain), domain]));
      const grants = new Map();
      let next = '';
      do {
        const { tuples, continuation_token: continuation } = await read('tracker:', next);
        for (const { key } of tuples) {
          const domain = byObject.get(key.object);
          const expiresAt = Date.parse(key.condition?.context?.expires_at);
          if (domain && key.condition?.name === 'unexpired' && expiresAt > Date.now()) grants.set(domain, expiresAt);
        }
        if (continuation && continuation === next) throw new Error('Invalid FGA cursor.');
        next = continuation;
      } while (next);
      return grants;
    },
  };
}

function createCiba(config, fetch = globalThis.fetch, wait = delay) {
  async function post(path, fields) {
    return fetch(config.issuer + path, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields }),
    });
  }

  async function verifyApprover(idToken) {
    const parts = typeof idToken === 'string' ? idToken.split('.') : [];
    if (parts.length !== 3) throw new Error('Auth0 returned an invalid ID token.');
    const [head, body, signature] = parts;
    const header = JSON.parse(Buffer.from(head, 'base64url'));
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || claims.iss !== config.issuer ||
        claims.sub !== config.subject || audience.length !== 1 || audience[0] !== config.clientId ||
        (claims.azp !== undefined && claims.azp !== config.clientId) ||
        !Number.isFinite(claims.iat) || claims.iat * 1000 > Date.now() + 60000 ||
        !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) {
      throw new Error('Auth0 returned an unexpected approver identity.');
    }
    const response = await fetch(config.issuer + '.well-known/jwks.json', {
      redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Auth0 signing keys unavailable.');
    const { keys } = await response.json();
    const jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig');
    if (!jwk || !verify('RSA-SHA256', Buffer.from(head + '.' + body),
      createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'))) {
      throw new Error('Auth0 ID token signature could not be verified.');
    }
  }

  return {
    async start(binding) {
      const response = await post('bc-authorize', {
        scope: 'openid',
        login_hint: JSON.stringify({ format: 'iss_sub', iss: config.issuer, sub: config.subject }),
        binding_message: binding,
      });
      if (!response.ok) throw new Error('Guardian request failed (HTTP ' + response.status + ').');
      const { auth_req_id: id, expires_in: seconds, interval = 5 } = await response.json();
      if (typeof id !== 'string' || !id || !Number.isInteger(seconds) || seconds < 1 || seconds > 300 ||
          !Number.isInteger(interval) || interval < 1) throw new Error('Invalid Guardian request response.');
      return { id, deadline: Date.now() + seconds * 1000, interval };
    },
    async waitForDecision({ id, deadline, interval }) {
      while (Date.now() < deadline) {
        await wait(Math.min(interval * 1000, Math.max(0, deadline - Date.now())));
        if (Date.now() >= deadline) break;
        const response = await post('oauth/token', { grant_type: CIBA_GRANT, auth_req_id: id });
        const data = await response.json();
        if (response.ok) {
          await verifyApprover(data.id_token);
          return 'approved';
        }
        if (data.error === 'authorization_pending') continue;
        if (data.error === 'slow_down') { interval += 5; continue; }
        if (data.error === 'access_denied') return 'denied';
        if (data.error === 'expired_token') break;
        throw new Error('Guardian status check failed (HTTP ' + response.status + ').');
      }
      return 'expired';
    },
  };
}

module.exports = { createFga, createCiba };
