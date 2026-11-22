const { createStore, createRule, evaluate } = require('./policy');
const local = require('./providers/local');
const { createAuth0 } = require('./providers/auth0');
const dryRun = require('./enforcers/dry-run');
const { createWindowsEnforcer } = require('./enforcers/windows-firewall');

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

function createHandler({ store = createStore(), auth0 = createAuth0(),
  enforcer = process.env.OUTBOUND_ENFORCE === 'firewall' ? createWindowsEnforcer() : dryRun } = {}) {
  const provider = auth0.configured ? auth0 : local;
  const withoutRule = { action: 'allow', via: provider.name };
  function canMutate(req, url) {
    return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      (!req.headers.origin || req.headers.origin === url.origin) && req.headers['sec-fetch-site'] !== 'cross-site';
  }
  async function apply(rule) {
    const plan = await enforcer.plan(rule);
    if (plan.some((entry) => entry.applied)) rule.firewallApplied = true;
    return plan;
  }
  return async function handle(req, res, url) {
    const endpoint = url.pathname;
    if (endpoint !== '/api/policy' && !endpoint.startsWith('/api/policy/')) return false;
    if (!canMutate(req, url)) return json(res, 403, { error: 'Open the local dashboard to manage policy.' });
    try {
      if (endpoint === '/api/policy' && req.method === 'GET') {
        const rules = await store.list();
        const plan = (await Promise.all(rules.map((rule) => enforcer.plan(rule, { preview: true })))).flat();
        return json(res, 200, { provider: provider.name, providerConfigured: auth0.configured, enforcer: enforcer.name, rules, plan });
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
        try { rule = createRule(input); } catch (error) { return json(res, 400, { error: error.message }); }
        let plan = [];
        let decision;
        try {
          decision = await provider.approve(rule, async (status) => {
            await store.update(async (rules) => {
              const current = rules.find((item) => item.id === rule.id);
              if (current) {
                const updated = { ...current, approval: { status, via: provider.name } };
                if (status === 'approved') await apply(updated);
                return rules.map((item) => item.id === updated.id ? updated : item);
              }
              if (status === 'approved') await provider.remove?.(rule);
              return rules;
            });
          });
        } catch { decision = { status: 'denied', via: provider.name }; }
        rule.approval = { status: decision.status, via: decision.via };
        await store.update(async (rules) => {
          if (decision.status === 'approved') plan = await apply(rule);
          else plan = await enforcer.plan(rule, { preview: true });
          return [...rules, rule];
        });
        if (decision.start) void decision.start().catch(() => {});
        return json(res, 201, { rule, decision: rule.approval, plan });
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
