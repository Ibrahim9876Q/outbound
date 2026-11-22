const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRule, evaluate } = require('./policy');
const { build, createWindowsEnforcer } = require('./enforcers/windows-firewall');
const { createAuth0 } = require('./providers/auth0');

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
