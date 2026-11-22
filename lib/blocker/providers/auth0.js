const { createCiba } = require('../../../gateway/auth0');

function createAuth0(env = process.env, fetch = globalThis.fetch) {
  const names = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_USER_ID',
    'FGA_API_URL', 'FGA_STORE_ID', 'FGA_CLIENT_ID', 'FGA_CLIENT_SECRET', 'OUTBOUND_FGA_MODEL_ID'];
  const id = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  const api = env.FGA_API_URL?.replace(/\/$/, '');
  if (!names.every((name) => env[name]?.trim()) || !/^https:\/\/api\.[a-z0-9-]+\.fga\.dev$/.test(api) ||
      !/^[a-z0-9.-]+\.auth0\.com$/i.test(env.AUTH0_DOMAIN) ||
      !id.test(env.FGA_STORE_ID) || !id.test(env.OUTBOUND_FGA_MODEL_ID)) return { name: 'auth0', configured: false };
  const ciba = createCiba({
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
  const tuple = (rule) => ({ user: 'user:laptop', relation: 'approved', object: 'policy_rule:' + rule.id });
  return {
    name: 'auth0', configured: true,
    async approve(rule, finish) {
      const pending = await ciba.start('Outbound policy ref ' + rule.id.slice(0, 12));
      pending.onDecision = async () => {
        try {
          if (await ciba.waitForDecision(pending) !== 'approved') return finish('denied');
          await fga('write', { writes: { tuple_keys: [tuple(rule)] } });
          await finish('approved');
        } catch { await finish('denied'); }
      };
      return { status: 'pending', via: 'auth0', start: pending.onDecision };
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
