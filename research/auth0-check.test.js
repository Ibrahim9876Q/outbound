const test = require('node:test');
const assert = require('node:assert/strict');
const { preflight } = require('./auth0-check');

test('Auth0 setup check validates discovery and performs one FGA query with no writes or phone requests', async () => {
  const id = '01YCP46JKYM8FJCQ37NMBYHE5X';
  const env = { AUTH0_LOGIN: '1', AUTH0_DOMAIN: 'fixture.us.auth0.com', AUTH0_CLIENT_ID: 'fixture-app',
    AUTH0_CLIENT_SECRET: 'fixture-secret', AUTH0_USER_ID: 'fixture-user', AUTH0_SESSION_KEY: 'ab'.repeat(32),
    FGA_API_URL: 'https://api.us1.fga.dev', FGA_STORE_ID: id,
    FGA_CLIENT_ID: 'fixture-fga', FGA_CLIENT_SECRET: 'fixture-secret', OUTBOUND_FGA_MODEL_ID: id };
  const issuer = 'https://fixture.us.auth0.com/';
  const calls = [];
  const result = await preflight(env, async (url, options) => {
    calls.push(url);
    if (url === issuer + '.well-known/openid-configuration') return Response.json({ issuer,
      authorization_endpoint: issuer + 'authorize', token_endpoint: issuer + 'oauth/token',
      jwks_uri: issuer + '.well-known/jwks.json' });
    if (url === issuer + '.well-known/jwks.json') return Response.json({ keys: [{ kty: 'RSA', use: 'sig', kid: 'fixture' }] });
    if (url === 'https://auth.fga.dev/oauth/token') return Response.json({ access_token: 'fixture', expires_in: 120 });
    assert.match(url, /\/stores\/.*\/check$/);
    const query = JSON.parse(options.body);
    assert.equal(query.authorization_model_id, id);
    assert.equal(query.tuple_key.relation, 'blocked');
    assert.match(query.tuple_key.object, /^domain:[0-9a-f-]{36}$/);
    return Response.json({ allowed: false });
  });
  assert.match(result, /read-only check/);
  assert.equal(calls.length, 4);
  await assert.rejects(preflight({}, () => assert.fail('No configuration must stay offline')), /incomplete or invalid/);
});
