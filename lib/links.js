const { runPoll } = require('./poll');
const path = require('node:path');
const { friendlyAppName } = require('./orgs');

const normalize = (address) => address?.toLowerCase().replace(/^::ffff:/, '');
const loopback = (address) => address === '::1' || /^127\./.test(address ?? '');

function buildLinks(apps, sample, previous = new Map(), now = Date.now()) {
  const nodes = new Map(apps.map(({ id, name }) => [id, { id, name, children: [], udp: [] }]));
  const relevant = new Set(nodes.keys());
  const processes = new Map((sample.processes ?? []).filter((p) => p.Name).map((p) => [p.ProcessId, p]));
  const edges = new Map();
  const node = (proc) => {
    const id = proc.Name.toLowerCase();
    if (!nodes.has(id)) nodes.set(id, { id, name: friendlyAppName(proc.Name), children: [], udp: [] });
    return nodes.get(id);
  };
  function add(kind, from, to, evidence, confidence = 'observed', key = '') {
    const id = JSON.stringify([kind, from.id, to.id, key]);
    edges.set(id, { id, from: from.name, to: to.name, kind, evidence, confidence, since: previous.get(id)?.since ?? now });
  }
  const local = new Map();
  for (const row of sample.tcp ?? []) {
    const a = normalize(row.LocalAddress), b = normalize(row.RemoteAddress);
    if (!loopback(a) || !loopback(b)) continue;
    local.set(JSON.stringify([a, row.LocalPort, b, row.RemotePort]), row);
  }
  for (const [key, row] of local) {
    const reverse = JSON.stringify([normalize(row.RemoteAddress), row.RemotePort, normalize(row.LocalAddress), row.LocalPort]);
    if (key >= reverse) continue;
    const peer = local.get(reverse);
    const a = processes.get(row.OwningProcess), b = processes.get(peer?.OwningProcess);
    if (!a || !b || a.Name.toLowerCase() === b.Name.toLowerCase()) continue;
    add('loopback', node(a), node(b), `Established TCP endpoints on local ports ${row.LocalPort} and ${row.RemotePort}`, 'observed', key);
  }
  const nativePairs = new Set([...edges.keys()].map((id) => JSON.parse(id).slice(1, 3).sort().join('|')));
  for (const link of sample.legacyLinks ?? []) {
    if (link.kind !== 'local' || !link.active || nativePairs.has([link.from, link.to].sort().join('|'))) continue;
    const from = nodes.get(link.from), to = nodes.get(link.to);
    if (from && to) add('loopback', from, to, `Reciprocal netstat TCP endpoints on local ports ${link.ports.join(', ')}`);
  }
  for (const child of processes.values()) {
    const parent = processes.get(child.ParentProcessId);
    if (!parent || parent.Name.toLowerCase() === child.Name.toLowerCase()) continue;
    if (!relevant.has(parent.Name.toLowerCase()) && !relevant.has(child.Name.toLowerCase())) continue;
    const from = node(parent), to = node(child);
    if (!from.children.includes(to.name)) from.children.push(to.name);
    add('parent', from, to, 'Windows process parent ID');
  }
  for (const row of sample.udp ?? []) {
    const proc = processes.get(row.OwningProcess);
    if (!proc || !nodes.has(proc.Name.toLowerCase())) continue;
    const app = node(proc);
    const { LocalPort: localPort, LocalAddress: localAddress } = row;
    if (app.udp.some((listener) => listener.localPort === localPort && listener.localAddress === localAddress)) continue;
    app.udp.push({ localPort, localAddress });
    add('udp', app, app, `UDP bound to [${localAddress}]:${localPort}; peer unknown`, 'observed', `${localAddress}|${localPort}`);
  }
  const names = [...nodes.values()].map((app) => [app, app.id.replace(/\.exe$/, '')])
    .filter(([, name]) => /^[a-z0-9]{4,}$/.test(name));
  for (const pipe of sample.pipes ?? []) {
    const tokens = pipe.toLowerCase().split(/[^a-z0-9]+/);
    const matches = names.filter(([, name]) => tokens.includes(name)).map(([app]) => app);
    if (matches.length === 1) add('pipe', matches[0], matches[0], 'Named pipe matched executable name; peer unknown', 'inferred', pipe);
    for (let i = 0; i < matches.length; i++) for (let j = i + 1; j < matches.length; j++) {
      add('pipe', matches[i], matches[j], 'Named pipe matched both executable names', 'inferred', pipe);
    }
  }
  const hubs = new Map();
  for (const app of apps) {
    for (const d of app.destinations ?? []) {
      if (!d.org || d.org === 'Unknown owner') continue;
      if (!hubs.has(d.org)) hubs.set(d.org, new Map());
      const members = hubs.get(d.org);
      members.set(app.id, Boolean(members.get(app.id) || d.tracker));
    }
  }
  for (const [company, members] of hubs) {
    if (members.size < 2) continue;
    const trackers = [...members.values()].filter(Boolean).length;
    const hub = { id: `company:${company}`, name: `company:${company}` };
    for (const [id, tracker] of members) {
      add('shared-company', nodes.get(id), hub, 'Recent endpoints attributed to the same company', 'inferred');
      if (tracker && trackers >= 2) add('shared-tracker', nodes.get(id), hub, 'Recent endpoints flagged for the same tracker company', 'inferred');
    }
  }
  return { nodes, edges };
}

class LinkWatcher {
  constructor() { this.current = { nodes: new Map(), edges: new Map() }; }

  async poll(apps, legacyLinks) {
    let sample = {};
    if (process.platform === 'win32') {
      sample = await runPoll('links.ps1', 'powershell.exe', ['-NoProfile', '-NonInteractive',
        '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'scripts', 'links.ps1')],
      { timeout: 12000, parse: JSON.parse }).catch(() => null);
      if (!sample) return;
    }
    this.current = buildLinks(apps, { ...sample, legacyLinks }, this.current.edges);
  }

  snapshot(apps) {
    const result = new Map(apps.map((app) => [app.id, { ...app, udp: [], children: [] }]));
    for (const { id, name, udp, children } of this.current.nodes.values()) {
      const app = result.get(id) ?? { id, name, icon: null, destinations: [], localPeers: [],
        activeConnections: 0, companies: 0, trackers: 0, background: { connections: 0, companies: [], trackers: [] } };
      result.set(id, { ...app, name, udp, children });
    }
    return { apps: [...result.values()], links: [...this.current.edges.values()] };
  }
}

module.exports = { buildLinks, LinkWatcher };
