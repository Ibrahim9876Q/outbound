const { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } = require('node:crypto');

const flowCookie = 'outbound_oidc';
const sessionCookie = 'outbound_session';
const random = () => randomBytes(32).toString('base64url');
const seconds = () => Math.floor(Date.now() / 1000);
const cookie = (name, value, age) => name + '=' + value + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + age;

function createAuth(env = process.env, fetch = globalThis.fetch) {
  const enabled = env.AUTH0_LOGIN === '1';
  const port = Number(env.PORT || 4317);
  const origin = 'http://127.0.0.1:' + port;
  const domain = env.AUTH0_DOMAIN;
  const client = env.AUTH0_CLIENT_ID;
  const secret = env.AUTH0_CLIENT_SECRET;
  const key = env.AUTH0_SESSION_KEY;
  const configured = Boolean(enabled && port > 0 && port <= 65535 &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.auth0\.com$/i.test(domain || '') && client && secret &&
    /^[a-f0-9]{64}$/i.test(key || ''));
  const issuer = 'https://' + domain + '/';
  const callback = origin + '/auth/callback';
  const sign = (name, payload) => createHmac('sha256', Buffer.from(key, 'hex'))
    .update(JSON.stringify([issuer, client, origin, name, payload])).digest();
  function seal(name, value) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return payload + '.' + sign(name, payload).toString('base64url');
  }
  function read(req, cookieName) {
    if (!configured) return null;
    try {
      const value = (req.headers.cookie || '').split(/;\s*/).find((part) => part.startsWith(cookieName + '='));
      const [payload, signature, extra] = (value || '').slice(cookieName.length + 1).split('.');
      if (!payload || !signature || extra !== undefined) return null;
      const actual = Buffer.from(signature, 'base64url');
      const expected = sign(cookieName, payload);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
      const claims = JSON.parse(Buffer.from(payload, 'base64url'));
      return claims.exp > seconds() ? claims : null;
    } catch { return null; }
  }
  const user = (req) => {
    const session = read(req, sessionCookie);
    return session?.sub ? { sub: session.sub, name: session.name } : null;
  };
  function reply(res, status, { location, cookies, data } = {}) {
    res.writeHead(status, {
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      ...(location && { Location: location }), ...(cookies && { 'Set-Cookie': cookies }),
      ...(data && { 'Content-Type': 'application/json; charset=utf-8' }),
    });
    res.end(data ? JSON.stringify(data) : undefined);
    return true;
  }
  async function get(path, options) {
    const response = await fetch(issuer + path, { redirect: 'error', signal: AbortSignal.timeout(8000), ...options });
    if (!response.ok) throw new Error('Auth0 request failed.');
    return response.json();
  }
  async function verifyIdentity(idToken, nonce) {
    const parts = typeof idToken === 'string' ? idToken.split('.') : [];
    if (parts.length !== 3) throw new Error('Invalid ID token.');
    const [head, body, signature] = parts;
    const header = JSON.parse(Buffer.from(head, 'base64url'));
    const claims = JSON.parse(Buffer.from(body, 'base64url'));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined ||
      claims.iss !== issuer || ![claims.aud].flat().includes(client) ||
      ((Array.isArray(claims.aud) && claims.aud.length > 1 || claims.azp !== undefined) && claims.azp !== client) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || claims.nonce !== nonce ||
      !Number.isFinite(claims.iat) || claims.iat > seconds() + 60 ||
      !Number.isFinite(claims.exp) || claims.exp <= seconds() ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > seconds()))) {
      throw new Error('Unexpected ID token claims.');
    }
    const { keys } = await get('.well-known/jwks.json');
    const jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA' &&
      (!candidate.use || candidate.use === 'sig') && (!candidate.alg || candidate.alg === 'RS256'));
    if (!jwk || !verify('RSA-SHA256', Buffer.from(head + '.' + body),
      createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signature, 'base64url'))) {
      throw new Error('Invalid ID token signature.');
    }
    return { sub: claims.sub, name: typeof claims.name === 'string' ? claims.name.slice(0, 128) : claims.sub,
      exp: Math.min(claims.exp, seconds() + 8 * 60 * 60) };
  }

  async function handle(req, res, url) {
    const action = /^\/auth\/(login|callback|logout|me)$/.exec(url.pathname)?.[1];
    if (!action) return false;
    if (req.method !== 'GET') return reply(res, 405);
    if (action === 'me' && !enabled) return reply(res, 200, { data: { enabled, configured, user: null } });
    if (!enabled) return reply(res, 404);
    if (!configured) return reply(res, action === 'me' ? 200 : 503,
      { data: { enabled, configured, user: null, error: 'Dashboard Auth0 login settings are incomplete.' } });
    if (req.headers.host !== new URL(origin).host ||
        !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return reply(res, 403);
    if (action === 'me') return reply(res, 200, { data: { enabled, configured, user: user(req) } });
    if (action === 'login') {
      const state = random();
      const nonce = random();
      const verifier = random();
      const params = new URLSearchParams({ response_type: 'code', client_id: client, redirect_uri: callback,
        scope: 'openid profile', state, nonce, code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url') });
      return reply(res, 302, { location: issuer + 'authorize?' + params,
        cookies: [cookie(flowCookie, seal(flowCookie, { state, nonce, verifier, exp: seconds() + 600 }), 600)] });
    }
    if (action === 'logout') {
      if (req.headers['sec-fetch-site'] === 'cross-site') return reply(res, 403);
      return reply(res, 302, { location: issuer + 'v2/logout?' + new URLSearchParams({ client_id: client, returnTo: origin + '/' }),
        cookies: [cookie(sessionCookie, '', 0), cookie(flowCookie, '', 0)] });
    }
    const cookies = [cookie(flowCookie, '', 0)];
    try {
      const flow = read(req, flowCookie);
      const code = url.searchParams.get('code');
      if (!flow || flow.state !== url.searchParams.get('state') || !code) throw new Error('Invalid login callback.');
      const token = await get('oauth/token', { method: 'POST', body: new URLSearchParams({
        grant_type: 'authorization_code', client_id: client, client_secret: secret, code,
        code_verifier: flow.verifier, redirect_uri: callback,
      }) });
      const identity = await verifyIdentity(token.id_token, flow.nonce);
      cookies.push(cookie(sessionCookie, seal(sessionCookie, identity), identity.exp - seconds()));
      return reply(res, 302, { location: '/', cookies });
    } catch {
      return reply(res, 400, { cookies, data: { error: 'Auth0 sign-in could not be verified. Start sign-in again.' } });
    }
  }
  return { enabled, configured, handle, user };
}

const auth = createAuth();
module.exports = { createAuth, ...auth };
