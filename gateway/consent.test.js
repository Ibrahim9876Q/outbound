const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { setImmediate: tick } = require('node:timers/promises');
const { test } = require('node:test');
const { createCiba, createFga } = require('./auth0');
const { createConsent } = require('./consent');

const domain = 'google-analytics.com';

test('FGA uses opaque tuple IDs and checks expiry and revocation at the store', async () => {
  const config = {
    api: 'https://api.us1.fga.dev/', store: 'test-store', model: 'test-model',
    clientId: 'fixture-client', clientSecret: 'fixture-secret', subject: 'fixture-user', key: Buffer.alloc(32, 7),
  };
  const tuples = new Map();
  let tokenRequests = 0;
  const fga = createFga(config, async (url, options) => {
    if (url === 'https://auth.fga.dev/oauth/token') {
      tokenRequests++;
      assert.equal(options.body.get('audience'), config.api);
      return Response.json({ access_token: 'fixture-token', expires_in: 120 });
    }
    assert.ok(url.startsWith(config.api + 'stores/test-store/'));
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    assert.ok(!options.body.includes(domain));
    assert.ok(!options.body.includes(config.subject));
    const body = JSON.parse(options.body);
    if (url.endsWith('/write')) {
      assert.equal(body.authorization_model_id, config.model);
      for (const key of body.deletes?.tuple_keys || []) tuples.delete(key.object);
      for (const key of body.writes?.tuple_keys || []) tuples.set(key.object, key);
      return Response.json({});
    }
    assert.equal(body.consistency, 'HIGHER_CONSISTENCY');
    const { object, user, relation } = body.tuple_key;
    assert.match(user, /^user:[a-f0-9]{64}$/);
    assert.equal(relation, 'can_resolve');
    if (url.endsWith('/read')) {
      const matching = object === 'tracker:' ? [...tuples.values()] : [tuples.get(object)].filter(Boolean);
      return Response.json({ tuples: matching.map((key) => ({ key })) });
    }
    assert.ok(url.endsWith('/check'));
    assert.equal(body.authorization_model_id, config.model);
    const condition = tuples.get(object)?.condition;
    const allowed = condition?.name === 'unexpired' &&
      Date.parse(body.context.current_time) < Date.parse(condition.context.expires_at);
    return Response.json({ allowed: Boolean(allowed) });
  });

  assert.equal(await fga.check(domain), false);
  await fga.grant(domain, Date.now() - 1000);
  assert.equal(await fga.check(domain), false);
  const expiry = Date.now() + 60000;
  await fga.grant(domain, expiry);
  assert.equal(await fga.check(domain), true);
  assert.deepEqual(await fga.list(new Set([domain])), new Map([[domain, expiry]]));
  await fga.revoke(domain);
  await fga.revoke(domain);
  assert.equal(await fga.check(domain), false);
  assert.equal(tokenRequests, 1);
});

test('CIBA binds the request to the approver and respects polling replies', async () => {
  const config = {
    issuer: 'https://tenant.example/', subject: 'auth0|approver',
    clientId: 'fixture-client', clientSecret: 'fixture-secret',
  };
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { ...publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig' };
  const waits = [];
  const replies = ['authorization_pending', 'slow_down', 'approved'];
  let subject = config.subject;
  function token() {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: key.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: config.issuer, sub: subject, aud: config.clientId, iat: now, exp: now + 60,
    })).toString('base64url');
    const input = header + '.' + payload;
    return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  }

  const ciba = createCiba(config, async (url, options) => {
    if (url.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [key] });
    assert.equal(options.body.get('client_id'), config.clientId);
    if (url.endsWith('/bc-authorize')) {
      assert.equal(options.body.get('binding_message'), 'Outbound ref 123456');
      assert.equal(options.body.get('scope'), 'openid');
      assert.deepEqual(JSON.parse(options.body.get('login_hint')), { format: 'iss_sub', iss: config.issuer, sub: config.subject });
      return Response.json({ auth_req_id: 'test-request', interval: 5, expires_in: 30 });
    }
    assert.ok(url.endsWith('/oauth/token'));
    assert.equal(options.body.get('auth_req_id'), 'test-request');
    assert.equal(options.body.get('grant_type'), 'urn:openid:params:grant-type:ciba');
    const result = replies.shift();
    return result === 'approved' ? Response.json({ id_token: token() }) : Response.json({ error: result }, { status: 403 });
  }, async (ms) => waits.push(ms));

  assert.equal(await ciba.waitForDecision(await ciba.start('Outbound ref 123456')), 'approved');
  assert.deepEqual(waits, [5000, 5000, 10000]);
  replies.push('access_denied', 'expired_token', 'approved');
  assert.equal(await ciba.waitForDecision(await ciba.start('Outbound ref 123456')), 'denied');
  assert.equal(await ciba.waitForDecision(await ciba.start('Outbound ref 123456')), 'expired');
  subject = 'auth0|other-user';
  await assert.rejects(ciba.waitForDecision(await ciba.start('Outbound ref 123456')), /unexpected approver/);
});

test('consent stays blocked while pending or denied and fails closed on FGA errors', async () => {
  const grantState = new Map();
  let decision;
  let canReachFga = true;
  const fga = {
    async check(tracker) {
      if (!canReachFga) throw new Error('unreachable');
      return (grantState.get(tracker) || 0) > Date.now();
    },
    async grant(tracker, expiresAt) { grantState.set(tracker, expiresAt); },
    async revoke(tracker) { grantState.delete(tracker); },
    async list() { return new Map(grantState); },
  };
  const ciba = {
    async start() { return { deadline: Date.now() + 30000 }; },
    waitForDecision() { return new Promise((resolve) => { decision = resolve; }); },
  };
  const service = createConsent({ fga, ciba, grantMinutes: 1 });
  assert.throws(() => service.request(domain), /has not been observed/);
  service.observe(domain);
  service.request(domain);
  await tick();
  assert.equal(service.snapshot().trackers[0].state, 'pending');
  assert.throws(() => service.request(domain), /current Guardian/);
  assert.equal(await service.allowTracker(domain), false);
  decision('denied');
  await tick();
  assert.equal(service.snapshot().trackers[0].state, 'denied');
  assert.equal(await service.allowTracker(domain), false);
  service.request(domain);
  await tick();
  decision('approved');
  await tick();
  assert.equal(service.snapshot().trackers[0].state, 'approved');
  assert.equal(await service.allowTracker(domain), true);
  canReachFga = false;
  assert.equal(await service.allowTracker(domain), false);
  canReachFga = true;
  await service.revoke(domain);
  assert.equal(service.snapshot().trackers[0].state, 'revoked');
  assert.equal(await service.allowTracker(domain), false);
});
