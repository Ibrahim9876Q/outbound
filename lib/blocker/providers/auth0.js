const { createCiba } = require('../../../gateway/auth0');

function createAuth0(env = process.env, fetch = globalThis.fetch, cibaFactory = createCiba) {
  const names = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_USER_ID',
    'FGA_API_URL', 'FGA_STORE_ID', 'FGA_CLIENT_ID', 'FGA_CLIENT_SECRET', 'OUTBOUND_FGA_MODEL_ID'];
  const id = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  const api = env.FGA_API_URL?.replace(/\/$/, '');
  if (!names.every((name) => env[name]?.trim()) || !/^https:\/\/api\.[a-z0-9-]+\.fga\.dev$/.test(api) ||
      !/^[a-z0-9.-]+\.auth0\.com$/i.test(env.AUTH0_DOMAIN) ||
      !id.test(env.FGA_STORE_ID) || !id.test(env.OUTBOUND_FGA_MODEL_ID)) return { name: 'auth0', configured: false };
  const ciba = cibaFactory({
    issuer: 'https://' + env.AUTH0_DOMAIN + '/', clientId: env.AUTH0_CLIENT_ID,
    clientSecret: env.AUTH0_CLIENT_SECRET, subject: env.AUTH0_USER_ID,
  }, fetch);
  const options = () => ({ method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000) });
  let token;
  let tokenRequest;
  async function getToken() {
    if (token?.until > Date.now()) return token.value;
    tokenRequest ??= (async () => {
      const result = await fetch('https://auth.fga.dev/oauth/token', {
        ...options(), body: new URLSearchParams({ grant_type: 'client_credentials', audience: api + '/',
          client_id: env.FGA_CLIENT_ID, client_secret: env.FGA_CLIENT_SECRET }),
      });
      if (!result.ok) throw new Error('FGA token request failed.');
      const data = await result.json();
      if (!data.access_token) throw new Error('FGA token was missing.');
      token = { value: data.access_token, until: Date.now() + Math.max(0, data.expires_in - 30) * 1000 };
      return token.value;
    })().finally(() => { tokenRequest = undefined; });
    return tokenRequest;
  }
  async function fga(operation, body) {
    const response = await fetch(api + '/stores/' + env.FGA_STORE_ID + '/' + operation, {
      ...options(), headers: { Authorization: 'Bearer ' + await getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorization_model_id: env.OUTBOUND_FGA_MODEL_ID, ...body }),
    });
    if (response.status === 401) token = undefined;
    if (!response.ok) throw new Error('FGA policy operation failed.');
    return response.status === 204 ? {} : response.json();
  }
  function tuple(rule) {
    const kind = rule.target.kind;
    const blocked = rule.approval?.model === 2 && rule.action === 'block' && ['app', 'company', 'domain'].includes(kind);
    return { user: 'user:laptop', relation: blocked ? 'blocked' : 'approved',
      object: (blocked ? kind : 'policy_rule') + ':' + rule.id };
  }
  return {
    name: 'auth0', configured: true,
    async approve(rule) {
      const bindingMessage = 'Outbound policy ref ' + rule.id.slice(0, 12);
      const pending = await ciba.start(bindingMessage);
      return { status: 'pending', via: 'auth0', bindingMessage, pending: {
        ...pending, nextPollAt: Date.now() + pending.interval * 1000,
      } };
    },
    async poll(pending) {
      const now = Date.now();
      if (now >= pending.deadline) return 'expired';
      if (now < pending.nextPollAt) return 'pending';
      // Respect the minimum interval even if the request fails.
      pending.nextPollAt = now + pending.interval * 1000;
      const status = await ciba.pollDecision(pending);
      if (status === 'slow_down') pending.interval += 5;
      pending.nextPollAt = Date.now() + pending.interval * 1000;
      return status === 'slow_down' ? 'pending' : status;
    },
    async grant(rule) {
      await fga('write', { writes: { tuple_keys: [tuple(rule)], on_duplicate: 'ignore' } });
    },
    async check(rule) {
      return (await fga('check', { tuple_key: tuple(rule), consistency: 'HIGHER_CONSISTENCY' })).allowed === true;
    },
    async remove(rule) {
      await fga('write', { deletes: { tuple_keys: [tuple(rule)] } });
    },
  };
}

module.exports = { createAuth0 };
