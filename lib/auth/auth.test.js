const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { Readable } = require('node:stream');
const { createAuth } = require('.');
const { createHandler } = require('../blocker/routes');

function request(handler, path, { cookie = '', method = 'GET', input } = {}) {
  const req = Object.assign(Readable.from(input ? [Buffer.from(JSON.stringify(input))] : []), {
    method, socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:4321', cookie, 'content-type': 'application/json' },
  });
  const result = {};
  return handler(req, {
    writeHead(status, headers) { Object.assign(result, { status, headers }); },
    end(body) { if (body) result.body = JSON.parse(body); },
  }, new URL(path, 'http://127.0.0.1:4321')).then(() => result);
}

test('OIDC binds state, PKCE, nonce and signing key, then records the signed-in policy author', async () => {
  const env = { AUTH0_LOGIN: '1', PORT: '4321', AUTH0_DOMAIN: 'fixture.auth0.com', AUTH0_CLIENT_ID: 'client',
    AUTH0_CLIENT_SECRET: 'fixture-secret', AUTH0_SESSION_KEY: 'ab'.repeat(32) };
  const issuer = 'https://fixture.auth0.com/';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrongKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  let authorize;
  let invalidNonce = true;
  let invalidSignature = false;
  let exchanges = 0;
  const auth = createAuth(env, async (url, options) => {
    if (url === issuer + '.well-known/jwks.json') return Response.json({ keys: [
      { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', use: 'sig' },
    ] });
    assert.equal(url, issuer + 'oauth/token');
    exchanges++;
    const verifier = options.body.get('code_verifier');
    assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorize.searchParams.get('code_challenge'));
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = encode({ alg: 'RS256', kid: 'fixture' }) + '.' + encode({
      iss: issuer, aud: 'client', sub: 'auth0|fixture', name: 'Fixture user', iat: now, exp: now + 3600,
      nonce: invalidNonce ? 'wrong' : authorize.searchParams.get('nonce'),
    });
    const signature = sign('RSA-SHA256', Buffer.from(content), invalidSignature ? wrongKey : privateKey);
    return Response.json({ id_token: content + '.' + signature.toString('base64url') });
  });
  const login = await request(auth.handle, '/auth/login');
  authorize = new URL(login.headers.Location);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.match(login.headers['Set-Cookie'][0], /HttpOnly; SameSite=Lax/);
  const cookie = login.headers['Set-Cookie'][0].split(';')[0];
  const callback = '/auth/callback?code=fixture&state=';
  assert.equal((await request(auth.handle, callback + 'wrong', { cookie })).status, 400);
  assert.equal(exchanges, 0);
  const validState = callback + authorize.searchParams.get('state');
  assert.equal((await request(auth.handle, validState, { cookie })).status, 400);
  invalidNonce = false;
  invalidSignature = true;
  assert.equal((await request(auth.handle, validState, { cookie })).status, 400);
  invalidSignature = false;
  const signedIn = await request(auth.handle, validState, { cookie });
  assert.equal(signedIn.status, 302);
  const session = signedIn.headers['Set-Cookie'][1].split(';')[0];
  assert.equal((await request(auth.handle, '/auth/me', { cookie: session })).body.user.name, 'Fixture user');
  assert.equal((await request(auth.handle, '/auth/me', { cookie: session.replace('=', '=A') })).body.user, null);
  const logout = await request(auth.handle, '/auth/logout', { cookie: session });
  assert.match(logout.headers['Set-Cookie'][0], /Max-Age=0/);
  const handler = createHandler({ signIn: auth, auth0: { configured: false },
    enforcer: require('../blocker/enforcers/dry-run'), store: { update: (change) => change([]) } });
  const input = { action: 'block', scope: 'session', target: { kind: 'domain', value: 'example.org' } };
  assert.equal((await request(handler, '/api/policy/rules', { method: 'POST', input })).status, 401);
  const result = await request(handler, '/api/policy/rules', { method: 'POST', input, cookie: session });
  assert.equal(result.body.rule.createdBy, 'auth0|fixture');
});

test('dashboard login is off by default and leaves local mode available', async () => {
  const auth = createAuth({}, () => assert.fail('unexpected Auth0 request'));
  assert.deepEqual((await request(auth.handle, '/auth/me')).body, { enabled: false, configured: false, user: null });
  assert.equal((await request(auth.handle, '/auth/login')).status, 404);
});
