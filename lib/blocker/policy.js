const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isIP } = require('node:net');

const priorities = { domain: 4, company: 3, app: 2, ip: 1 };
const normalize = (value) => String(value ?? '').trim().toLowerCase();
const domain = (value) => normalize(value).replace(/\.$/, '');

function validateTarget(target = {}) {
  const { kind, value } = target;
  if (!Object.hasOwn(priorities, kind) || typeof value !== 'string' || !value.trim() || value.length > 512 || /[\x00-\x1f]/.test(value)) {
    throw new Error('Supply a valid policy target.');
  }
  if (kind === 'domain' && !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/i.test(domain(value))) {
    throw new Error('Supply a DNS domain without a scheme or path.');
  }
  if (kind === 'ip' && !validAddress(value.trim())) throw new Error('Supply a valid IP address or CIDR.');
  const addresses = target.addresses;
  if (addresses !== undefined && (kind !== 'company' || !Array.isArray(addresses) || !addresses.length ||
      addresses.length > 100 || addresses.some((item) => typeof item !== 'string' || !validAddress(item)))) {
    throw new Error('Supply only valid company IP addresses or CIDR ranges.');
  }
  const program = target.program;
  if (program !== undefined && (kind !== 'app' || typeof program !== 'string' || !validProgram(program))) {
    throw new Error('Supply an absolute Windows executable path.');
  }
  return { kind, value: value.trim(), ...(addresses === undefined ? {} : { addresses: [...new Set(addresses)] }),
    ...(program === undefined ? {} : { program }) };
}

function validProgram(value) {
  return typeof value === 'string' && /^[a-z]:\\[^<>:"/|?*&^%!\x00-\x1f]+\.exe$/i.test(value);
}

function validAddress(value) {
  const [address, bits, extra] = value.split('/');
  const family = isIP(address);
  return Boolean(family && extra === undefined &&
    (bits === undefined || (/^\d{1,3}$/.test(bits) && Number(bits) <= (family === 4 ? 32 : 128))));
}

function ipMatches(address, prefix) {
  if (!address || !isIP(address)) return false;
  const [network, bits] = prefix.split('/');
  if (isIP(address) !== isIP(network)) return false;
  const { BlockList } = require('node:net');
  const type = isIP(network) === 4 ? 'ipv4' : 'ipv6';
  const list = new BlockList();
  if (bits === undefined) list.addAddress(network, type);
  else list.addSubnet(network, Number(bits), type);
  return list.check(address, type);
}

function evaluate(rules, request = {}) {
  let best;
  for (const rule of rules) {
    if (rule.approval?.status === 'denied') continue;
    const { kind, value } = rule.target;
    const matches = kind === 'domain'
      ? domain(request.domain) === domain(value) || domain(request.domain).endsWith('.' + domain(value))
      : kind === 'ip' ? ipMatches(request.ip, value) : normalize(request[kind]) === normalize(value);
    if (matches && (!best || priorities[kind] > priorities[best.target.kind] ||
        (priorities[kind] === priorities[best.target.kind] && rule.createdAt >= best.createdAt))) best = rule;
  }
  return best;
}

function createRule(input) {
  if (!['block', 'allow', 'ask'].includes(input.action) || !['always', 'session'].includes(input.scope)) {
    throw new Error('Supply a valid action and scope.');
  }
  return { id: randomUUID(), target: validateTarget(input.target), action: input.action,
    scope: input.scope, createdBy: 'local', createdAt: new Date().toISOString(), approval: null };
}

function createStore(file = path.join(__dirname, '..', '..', 'data', 'policy.json')) {
  let pending = Promise.resolve();
  let current;
  async function read() {
    if (!current) {
      try {
        const saved = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!Array.isArray(saved)) throw new SyntaxError('Invalid policy document');
        for (const rule of saved) {
          if (typeof rule?.id !== 'string' || !['always', 'session'].includes(rule.scope) ||
              !['block', 'allow', 'ask'].includes(rule.action)) throw new SyntaxError('Invalid policy rule');
          try { validateTarget(rule.target); } catch { throw new SyntaxError('Invalid policy target'); }
        }
        current = saved.filter((rule) => rule.scope === 'always');
      } catch (error) {
        if (error instanceof SyntaxError) throw Object.assign(new Error('Local policy file is invalid. Existing rules were left untouched.'),
          { code: 'INVALID_POLICY' });
        if (error.code !== 'ENOENT') throw error;
        current = [];
      }
    }
    return current;
  }
  function update(change) {
    const result = pending.then(async () => {
      const next = await change([...(await read())]);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file + '.tmp', JSON.stringify(next.filter((rule) => rule.scope === 'always'), null, 2) + '\n');
      await fs.rename(file + '.tmp', file);
      current = next;
      return next;
    });
    pending = result.catch(() => {});
    return result;
  }
  return { list: async () => { await pending; return read(); }, update };
}

module.exports = { createRule, createStore, evaluate, validAddress, validProgram };
