const { createStore, createRule, evaluate, validProgram } = require('./policy');
const local = require('./providers/local');
const { createAuth0 } = require('./providers/auth0');
const { Auth0Error } = require('../../gateway/auth0');
const dryRun = require('./enforcers/dry-run');
const { createWindowsEnforcer } = require('./enforcers/windows-firewall');
const { createProgramResolver } = require('./programs');

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
  return true;
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) return null;
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function createHandler({ store = createStore(), auth0 = createAuth0(), signIn = require('../auth'), resolvePrograms = createProgramResolver(),
  enforcer = process.env.OUTBOUND_ENFORCE === 'firewall' ? createWindowsEnforcer() : dryRun } = {}) {
  const provider = auth0.configured ? auth0 : local;
  const requests = new Map();
  const withoutRule = { action: 'allow', via: provider.name };
  function canMutate(req, url) {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
      sameLocalHost(req, url) && req.headers['sec-fetch-site'] !== 'cross-site';
  }
  // server.js parses req.url against a fixed base, so url.origin has no port. Check the Host header
  // (DNS-rebinding guard) and compare Origin with that host instead.
  function sameLocalHost(req, url) {
    let host;
    try { host = new URL('http://' + (req.headers.host || url.host)); } catch { return false; }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)) return false;
    return !req.headers.origin || req.headers.origin === host.origin;
  }
  async function apply(rule) {
    const plan = await enforcer.plan(rule);
    if (plan.some((entry) => entry.applied)) rule.firewallApplied = true;
    return plan;
  }
  async function discover(rule) {
    const { kind, value, program, programs } = rule.target;
    if (kind !== 'app' || program || programs?.length || validProgram(value) || rule.action !== 'block') return rule;
    const matches = await resolvePrograms(value).catch(() => []);
    return { ...rule, target: { ...rule.target, programs: matches } };
  }
  function describe(rule, plan) {
    const { status, requestId, bindingMessage, error } = rule.approval;
    const pending = requests.get(requestId)?.pending;
    return { status, rule, decision: rule.approval, plan, ...(requestId && { requestId, bindingMessage }),
      ...(error && { error }),
      ...(pending && status === 'pending' && { expiresAt: pending.deadline,
        retryAfterMs: Math.max(0, Math.min(pending.nextPollAt, pending.deadline) - Date.now()) }) };
  }
  async function advance(rule, request) {
    let status = 'denied';
    let error;
    try {
      if (request) {
        request.status = request.status === 'approved' ? 'approved' : await auth0.poll(request.pending);
        if (request.status === 'pending') return describe(rule, await dryRun.plan(rule));
        if (request.status === 'approved') status = 'approved';
        if (request.status === 'expired') error = 'The phone approval request expired. Start a new request.';
      } else {
        error = 'The phone approval request was interrupted. Start a new request.';
      }
    } catch (failure) {
      error = failure instanceof Auth0Error ? failure.message : 'Auth0 could not verify phone approval.';
    }
    let updated;
    let plan = [];
    await store.update(async (rules) => {
      const current = rules.find((item) => item.id === rule.id);
      if (!current) return rules;
      updated = await discover({ ...current, approval: { ...current.approval, status, ...(error && { error }) } });
      if (status === 'approved') await auth0.grant(updated);
      plan = await dryRun.plan(updated);
      return rules.map((item) => item.id === updated.id ? updated : item);
    });
    requests.delete(rule.id);
    return updated ? describe(updated, plan) : null;
  }
  return async function handle(req, res, url) {
    const endpoint = url.pathname;
    if (endpoint !== '/api/policy' && !endpoint.startsWith('/api/policy/')) return false;
    if (!canMutate(req, url)) return json(res, 403, { error: 'Open the local dashboard to manage policy.' });
    const requestId = /^\/api\/policy\/requests\/([a-f0-9-]{36})$/i.exec(endpoint)?.[1];
    const changesPolicy = (req.method === 'POST' && endpoint === '/api/policy/rules') || req.method === 'DELETE' || Boolean(requestId);
    const actor = signIn.enabled && changesPolicy ? signIn.user(req) : null;
    if (signIn.enabled && changesPolicy && !actor) return json(res, 401, { error: 'Sign in to change policy.' });
    try {
      if (endpoint === '/api/policy' && req.method === 'GET') {
        const rules = await store.list();
        const plan = (await Promise.all(rules.map(async (rule) => enforcer.plan(await discover(rule), { preview: true })))).flat();
        return json(res, 200, { provider: provider.name, providerConfigured: auth0.configured, enforcer: enforcer.name, rules, plan });
      }
      if (requestId && req.method === 'GET') {
        const rule = (await store.list()).find((item) => item.approval?.requestId === requestId &&
          (!actor || item.createdBy === actor.sub));
        if (!rule) return json(res, 404, { error: 'Unknown phone approval request.' });
        if (rule.approval.status !== 'pending') return json(res, 200, describe(rule, await dryRun.plan(rule)));
        const request = requests.get(requestId);
        const result = await (request
          ? (request.inFlight ??= advance(rule, request).finally(() => { delete request.inFlight; }))
          : advance(rule, null));
        return result ? json(res, 200, result) : json(res, 404, { error: 'Unknown phone approval request.' });
      }
      if (req.method === 'POST' && ['/api/policy/rules', '/api/policy/check'].includes(endpoint)) {
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
          return json(res, 415, { error: 'Send application/json.' });
        }
        const input = await body(req);
        if (!input) return json(res, 400, { error: 'Supply a JSON object of at most 8 KB.' });
        if (endpoint.endsWith('/check')) {
          const rule = evaluate(await store.list(), input);
          if (!rule) return json(res, 200, withoutRule);
          let action = 'ask';
          if (rule.approval?.status === 'approved') {
            const owningProvider = rule.approval.via === 'auth0' ? auth0 : local;
            if (owningProvider.configured && await owningProvider.check(rule).catch(() => false)) action = rule.action;
          }
          return json(res, 200, { action, ruleId: rule.id, via: rule.approval?.via || provider.name });
        }
        let rule;
        try { rule = await discover(createRule(input)); } catch (error) { return json(res, 400, { error: error.message }); }
        if (actor) rule.createdBy = actor.sub;
        let plan = [];
        let decision;
        try {
          decision = await provider.approve(rule);
        } catch (error) {
          decision = { status: 'denied', via: provider.name,
            error: error instanceof Auth0Error ? error.message : 'Auth0 could not start phone approval.' };
        }
        rule.approval = { status: decision.status, via: decision.via };
        if (decision.pending) Object.assign(rule.approval, { model: 2, requestId: rule.id, bindingMessage: decision.bindingMessage });
        if (decision.error) rule.approval.error = decision.error;
        await store.update(async (rules) => {
          if (decision.status === 'approved') plan = await apply(rule);
          else plan = await enforcer.plan(rule, { preview: true });
          return [...rules, rule];
        });
        if (decision.pending) requests.set(rule.id, { pending: decision.pending });
        return json(res, 201, describe(rule, plan));
      }
      const id = /^\/api\/policy\/rules\/([a-f0-9-]{36})$/i.exec(endpoint)?.[1];
      if (req.method === 'DELETE' && id) {
        let plan = [];
        let exists = false;
        let retained = false;
        await store.update(async (rules) => {
          const rule = rules.find((item) => item.id === id);
          if (!rule) return rules;
          exists = true;
          plan = await enforcer.plan(rule, { remove: true });
          if (rule.firewallApplied && !plan.some((entry) => entry.applied)) {
            retained = true;
            return rules;
          }
          if (rule.approval?.via === 'auth0' && rule.approval.status === 'approved' && auth0.configured) await auth0.remove(rule);
          return rules.filter((item) => item.id !== id);
        });
        if (exists && !retained) requests.delete(id);
        return json(res, retained ? 409 : exists ? 200 : 404, { ok: exists && !retained, plan });
      }
      return json(res, 404, { error: 'Unknown policy endpoint.' });
    } catch {
      return json(res, 503, { error: 'Could not read or update local policy.' });
    }
  };
}

let defaultHandler;
module.exports = { createHandler, handle: (req, res, url) => (defaultHandler ??= createHandler())(req, res, url) };
