const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRule, evaluate } = require('./policy');
const { build, createWindowsEnforcer } = require('./enforcers/windows-firewall');
const { createAuth0 } = require('./providers/auth0');
const { createProgramResolver } = require('./programs');
const { createHandler } = require('./routes');
const { Readable } = require('node:stream');

function rule(kind, value, action = 'block', at = '2026-11-22T00:00:00Z') {
  return { ...createRule({ target: { kind, value }, action, scope: 'always' }), createdAt: at,
    approval: { status: 'approved', via: 'local' } };
}

test('policy selects domain over company over app, then newest within a level', () => {
  const app = rule('app', 'Chrome');
  const company = rule('company', 'Google', 'allow');
  const oldDomain = rule('domain', 'analytics.example', 'block');
  const newDomain = rule('domain', 'analytics.example', 'ask', '2026-11-23T00:00:00Z');
  const rules = [newDomain, oldDomain, app, company];
  assert.equal(evaluate(rules, { domain: 'stats.analytics.example.', company: 'Google', app: 'Chrome' }).id, newDomain.id);
  assert.equal(evaluate(rules, { domain: 'notanalytics.example', company: 'Google', app: 'Chrome' }).id, company.id);
  assert.equal(evaluate(rules, { app: 'chrome' }).id, app.id);
  const ip = rule('ip', '192.0.2.0/24');
  assert.equal(evaluate([ip], { ip: '192.0.2.5' }).id, ip.id);
});

test('Windows plan builds exact outbound program and company address commands', () => {
  const app = rule('app', 'C:\\Program Files\\Example\\app.exe');
  assert.equal(build(app)[0].command,
    'netsh advfirewall firewall add rule name=Outbound-' + app.id + ' dir=out action=block program="C:\\Program Files\\Example\\app.exe"');
  const company = rule('company', 'Example');
  company.target.addresses = ['192.0.2.0/24', '2001:db8::1'];
  assert.equal(build(company)[0].command,
    'netsh advfirewall firewall add rule name=Outbound-' + company.id + ' dir=out action=block remoteip=192.0.2.0/24,2001:db8::1');
  assert.match(build(company, true)[0].command, /firewall delete rule/);
  assert.equal(build(rule('domain', 'analytics.example')).length, 0);
});

test('Windows firewall never executes without explicit mode and elevation', async () => {
  const target = rule('ip', '192.0.2.1');
  const calls = [];
  const run = async (...args) => calls.push(args);
  const make = (mode, elevated) => createWindowsEnforcer({ mode, platform: 'win32', run, elevated: async () => elevated });
  assert.equal((await make('dry-run', true).plan(target))[0].applied, false);
  assert.equal((await make('firewall', false).plan(target))[0].applied, false);
  assert.equal((await make('firewall', true).plan(target, { preview: true }))[0].applied, false);
  assert.equal(calls.length, 0);
  assert.equal((await make('firewall', true).plan(target))[0].applied, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'netsh.exe');
});

test('a corrupt policy returns a warning and preserves the original file', async (t) => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const { createStore } = require('./policy');
  const directory = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'outbound-corrupt-policy-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'policy.json');
  const invalid = '[{"scope":"always","target":null}]';
  await fs.writeFile(file, invalid);
  let requests = 0;
  const handler = createHandler({ store: createStore(file), signIn: { enabled: false, user: () => null },
    auth0: { configured: true, approve: () => { requests++; } } });
  for (const [method, endpoint] of [['GET', '/api/policy'], ['POST', '/api/policy/rules']]) {
    const payload = { action: 'block', scope: 'session', target: { kind: 'domain', value: 'example.test' } };
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(payload))]), { method,
      headers: { host: '127.0.0.1', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
    await handler(req, { writeHead: (status) => assert.equal(status, 503),
      end: (data) => assert.match(JSON.parse(data).error, /Local policy file is invalid/) }, new URL(endpoint, 'http://127.0.0.1'));
  }
  assert.equal(requests, 0);
  assert.equal(await fs.readFile(file, 'utf8'), invalid);
});

test('Auth0 is optional and missing environment never makes a request', () => {
  assert.equal(createAuth0({}, () => assert.fail('unexpected network call')).configured, false);
});

test('app-name requests preview every distinct running path and explain companies without IPs', async () => {
  const programs = ['C:\\Users\\Fixture\\Discord\\Discord.exe', 'D:\\Discord Test\\Discord.exe'];
  const resolvePrograms = createProgramResolver({
    apps: [{ id: 'discord', name: 'Discord', processNames: ['Discord.exe'] }],
    list: async () => [
      ...programs.map((ExecutablePath) => ({ Name: 'Discord.exe', ExecutablePath })),
      { Name: 'Discord.exe', ExecutablePath: programs[0] },
      { Name: 'Discord.exe', ExecutablePath: null },
      { Name: 'Other.exe', ExecutablePath: 'C:\\Apps\\Other.exe' },
    ],
  });
  let saved = [];
  const handler = createHandler({ resolvePrograms, auth0: { configured: false },
    enforcer: require('./enforcers/dry-run'),
    store: { list: async () => saved, update: async (change) => { saved = await change(saved); } },
  });
  async function post(target) {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ target, action: 'block', scope: 'always' }))]), {
      method: 'POST', socket: { remoteAddress: '127.0.0.1' },
      headers: { host: '127.0.0.1:4321', origin: 'http://127.0.0.1:4321', 'content-type': 'application/json' },
    });
    let output;
    await handler(req, { writeHead: (status) => assert.equal(status, 201), end: (data) => { output = JSON.parse(data); } },
      new URL('http://127.0.0.1/api/policy/rules'));
    return output;
  }
  const app = await post({ kind: 'app', value: 'Discord' });
  assert.deepEqual(app.rule.target.programs, programs);
  assert.deepEqual(app.plan.map((entry) => entry.command), [
    'netsh advfirewall firewall add rule name=Outbound-' + app.rule.id + '-1 dir=out action=block program=' + programs[0],
    'netsh advfirewall firewall add rule name=Outbound-' + app.rule.id + '-2 dir=out action=block program="' + programs[1] + '"',
  ]);
  assert.ok(app.plan.every((entry) => entry.applied === false && entry.reason.startsWith('Dry run')));
  assert.deepEqual((await post({ kind: 'company', value: 'Example' })).plan, [
    { command: '', applied: false, reason: 'No addresses are observed yet for this company.' },
  ]);
});

test('policy request polls CIBA with rate limits and writes an opaque FGA tuple once after approval', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const id = '01YCP46JKYM8FJCQ37NMBYHE5X';
  const requests = [];
  const env = {
    AUTH0_DOMAIN: 'fixture.us.auth0.com', AUTH0_CLIENT_ID: 'fixture', AUTH0_CLIENT_SECRET: 'fixture',
    AUTH0_USER_ID: 'fixture', FGA_API_URL: 'https://api.us1.fga.dev/', FGA_STORE_ID: id,
    FGA_CLIENT_ID: 'fixture', FGA_CLIENT_SECRET: 'fixture', OUTBOUND_FGA_MODEL_ID: id,
  };
  let cibaPolls = 0;
  let bindingMessage;
  const { generateKeyPairSync, sign } = require('node:crypto');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fixtureFetch = async (url, options) => {
    if (url === 'https://auth.fga.dev/oauth/token') return Response.json({ access_token: 'fixture', expires_in: 120 });
    if (url.endsWith('/bc-authorize')) {
      bindingMessage = options.body.get('binding_message');
      return Response.json({ auth_req_id: 'private-auth-request', expires_in: 60, interval: 1 });
    }
    if (url.endsWith('/oauth/token')) {
      assert.equal(options.body.get('auth_req_id'), 'private-auth-request');
      cibaPolls++;
      if (cibaPolls === 3) {
        const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const iat = Math.floor(Date.now() / 1000);
        const payload = encode({ alg: 'RS256', kid: 'fixture' }) + '.' + encode({
          sub: env.AUTH0_USER_ID, aud: env.AUTH0_CLIENT_ID, iss: 'https://' + env.AUTH0_DOMAIN + '/',
          iat, exp: iat + 60,
        });
        return Response.json({ id_token: payload + '.' + sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url') });
      }
      const status = ['authorization_pending', 'slow_down', null, 'access_denied'][cibaPolls - 1];
      return Response.json({ error: status }, { status: 400 });
    }
    if (url.endsWith('/jwks.json')) return Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture', use: 'sig' }] });
    requests.push([url.split('/').at(-1), JSON.parse(options.body)]);
    return Response.json({ allowed: true });
  };
  const provider = createAuth0(env, fixtureFetch);
  assert.equal(provider.configured, true);
  let saved = [];
  const handler = createHandler({ auth0: provider, signIn: { enabled: false },
    store: { list: async () => saved, update: async (change) => { saved = await change(saved); } } });
  const target = { kind: 'company', value: 'Private local target', addresses: ['192.0.2.1'] };
  async function request(endpoint, input) {
    const req = Object.assign(Readable.from(input ? [Buffer.from(JSON.stringify(input))] : []), {
      method: input ? 'POST' : 'GET', socket: { remoteAddress: '127.0.0.1' },
      headers: { host: '127.0.0.1:4321', 'content-type': 'application/json' },
    });
    let result;
    await handler(req, { writeHead() {}, end: (data) => { result = JSON.parse(data); } },
      new URL(endpoint, 'http://127.0.0.1:4321'));
    return result;
  }
  const input = { action: 'block', scope: 'session', target };
  const pending = await request('/api/policy/rules', input);
  const endpoint = '/api/policy/requests/' + pending.requestId;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.bindingMessage, bindingMessage);
  assert.match(bindingMessage, /^Outbound policy ref [a-f0-9-]+$/);
  assert.ok(!JSON.stringify(pending).includes('private-auth-request'));
  assert.equal((await request(endpoint)).status, 'pending');
  assert.equal(cibaPolls, 0);
  t.mock.timers.tick(1000);
  assert.equal((await request(endpoint)).status, 'pending');
  t.mock.timers.tick(1000);
  assert.equal((await request(endpoint)).retryAfterMs, 6000);
  t.mock.timers.tick(5999);
  assert.equal((await request(endpoint)).status, 'pending');
  assert.equal(cibaPolls, 2);
  assert.deepEqual(requests, []);
  t.mock.timers.tick(1);
  const approved = await Promise.all([request(endpoint), request(endpoint)]);
  assert.ok(approved.every((result) => result.status === 'approved' && result.plan[0].applied === false));
  assert.equal(cibaPolls, 3);
  assert.equal(requests.length, 1);
  assert.equal(await provider.check(approved[0].rule), true);
  const tuple = { user: 'user:laptop', relation: 'blocked', object: 'company:' + pending.rule.id };
  assert.equal(requests[0][0], 'write');
  assert.deepEqual(requests[0][1].writes.tuple_keys, [tuple]);
  assert.equal(requests[1][0], 'check');
  assert.deepEqual(requests[1][1].tuple_key, tuple);
  assert.ok(!JSON.stringify(requests).includes(target.value));
  const denied = await request('/api/policy/rules', input);
  t.mock.timers.tick(1000);
  assert.equal((await request('/api/policy/requests/' + denied.requestId)).status, 'denied');
  assert.equal(requests.length, 2);
});
