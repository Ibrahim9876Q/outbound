const { randomUUID } = require('node:crypto');
const { createAuth } = require('../lib/auth');
const { createAuth0 } = require('../lib/blocker/providers/auth0');

async function preflight(env, fetch = globalThis.fetch) {
  if (!createAuth(env, fetch).configured) throw new Error('Dashboard sign-in variables are incomplete or invalid.');
  const policy = createAuth0(env, fetch);
  if (!policy.configured) throw new Error('Phone approval or desktop FGA variables are incomplete or invalid.');
  const issuer = 'https://' + env.AUTH0_DOMAIN + '/';
  async function read(url, label) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch { throw new Error(label + ' is unavailable. Check the tenant hostname and network.'); }
  }
  const discovery = await read(issuer + '.well-known/openid-configuration', 'Auth0 discovery');
  if (discovery.issuer !== issuer || discovery.authorization_endpoint !== issuer + 'authorize' ||
      discovery.token_endpoint !== issuer + 'oauth/token' || discovery.jwks_uri !== issuer + '.well-known/jwks.json') {
    throw new Error('Auth0 discovery did not describe the expected tenant endpoints.');
  }
  const { keys } = await read(discovery.jwks_uri, 'Auth0 signing keys');
  if (!keys?.some((key) => key.kty === 'RSA' && key.use === 'sig' && key.kid)) {
    throw new Error('Auth0 did not advertise an RSA signing key. Check the application’s RS256 setting.');
  }
  try {
    const existing = await policy.check({ id: randomUUID(), action: 'block', target: { kind: 'domain' }, approval: { model: 2 } });
    if (existing) throw new Error();
  } catch {
    throw new Error('FGA rejected the read-only check. Verify the regional API, store, desktop model ID, and client Query permission.');
  }
  return 'Auth0 tenant discovery and signing keys passed. FGA accepted a read-only check against the desktop policy model.';
}

if (require.main === module) {
  preflight(process.env).then(console.log, (error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { preflight };
