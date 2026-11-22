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

test('Auth0 approval writes an opaque FGA tuple and check looks it up', async () => {
  const id = '01YCP46JKYM8FJCQ37NMBYHE5X';
  const requests = [];
  const env = {
    AUTH0_DOMAIN: 'fixture.us.auth0.com', AUTH0_CLIENT_ID: 'fixture', AUTH0_CLIENT_SECRET: 'fixture',
    AUTH0_USER_ID: 'fixture', FGA_API_URL: 'https://api.us1.fga.dev/', FGA_STORE_ID: id,
    FGA_CLIENT_ID: 'fixture', FGA_CLIENT_SECRET: 'fixture', OUTBOUND_FGA_MODEL_ID: id,
  };
  const provider = createAuth0(env, async (url, options) => {
    if (url === 'https://auth.fga.dev/oauth/token') return Response.json({ access_token: 'fixture', expires_in: 120 });
    requests.push([url.split('/').at(-1), JSON.parse(options.body)]);
    return Response.json({ allowed: true });
  }, () => ({
    async start(binding) {
      assert.match(binding, /^Outbound policy ref [a-f0-9-]+$/);
      return { id: 'fixture' };
    },
    async waitForDecision() { return 'approved'; },
  }));
  assert.equal(provider.configured, true);
  const requested = rule('company', 'Private local target');
  const results = [];
  const pending = await provider.approve(requested, async (status) => results.push(status));
  assert.equal(pending.status, 'pending');
  assert.deepEqual(requests, []);
  await pending.start();
  assert.deepEqual(results, ['approved']);
  assert.equal(await provider.check(requested), true);
  const tuple = { user: 'user:laptop', relation: 'approved', object: 'policy_rule:' + requested.id };
  assert.equal(requests[0][0], 'write');
  assert.deepEqual(requests[0][1].writes.tuple_keys, [tuple]);
  assert.equal(requests[1][0], 'check');
  assert.deepEqual(requests[1][1].tuple_key, tuple);
  assert.ok(!JSON.stringify(requests).includes(requested.target.value));
});
