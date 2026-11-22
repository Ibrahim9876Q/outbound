// Watches which app is connected to which server, where that server is, and which apps talk to each other.
const { runPoll } = require('./poll');
const dns = require('dns').promises;
const path = require('path');
const geoip = require('geoip-lite');
const { DailyNetworkReport, backgroundSummary } = require('./report');
const { ForegroundWatcher } = require('./foreground');
const { SeenCompanies } = require('./seen');
const { orgForHost, isTracker, trackerCategory, baseDomain, friendlyAppName } = require('./orgs');
const { lookupAsn, loadAsn } = require('./asn');

loadAsn();

const SCRIPTS = path.join(__dirname, '..', 'scripts');
const RECENT_MS = 10 * 60 * 1000; // keep destinations on screen for 10 min after they close
const MAX_INACTIVE_DESTINATIONS = 80;
// OS reverse DNS shares Node's worker pool with filesystem reads.
const MAX_PTR_LOOKUPS = 2;

function run(cmd, args, input) {
  return runPoll(cmd, cmd, args, { input });
}

function ps(script, input) {
  return runPoll(script, 'powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(SCRIPTS, script)],
    { input, timeout: script === 'icons.ps1' ? 15000 : 8000, parse: (text) => text.trim() ? JSON.parse(text) : null });
}

function splitAddr(addr) {
  const i = addr.lastIndexOf(':');
  const ip = addr.slice(0, i).replace(/^\[|\]$/g, '').replace(/%\d+$/, '').toLowerCase();
  return { ip: normalizeIp(ip), port: Number(addr.slice(i + 1)) };
}

function normalizeIp(ip) { return ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, ''); }
function isLoopback(ip) { return ip.startsWith('127.') || ip === '::1'; }
function isUnspecified(ip) { return ip === '0.0.0.0' || ip === '::' || ip === '*'; }
function isPrivate(ip) {
  if (/^(10\.|192\.168\.|169\.254\.)/.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (/^(fe[89ab]|fc|fd)/i.test(ip)) return true;
  return false;
}

async function readConnections() {
  const out = await run('netstat', ['-ano']);
  const conns = [];
  for (const line of out.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] !== 'TCP' || parts.length < 5) continue;
    const local = splitAddr(parts[1]);
    const remote = splitAddr(parts[2]);
    conns.push({ local, remote, state: parts[3], pid: Number(parts[4]) });
  }
  return conns;
}

function socketKey(local, remote) {
  return `${local.ip}|${local.port}|${remote.ip}|${remote.port}`;
}

async function readTasklist() {
  const out = await run('tasklist', ['/fo', 'csv', '/nh']);
  const map = new Map();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if (m) map.set(Number(m[2]), m[1]);
  }
  return map;
}

class NetworkWatcher {
  pruneInactive(now) {
    const inactive = new Map();
    for (const [key, flow] of this.flows) {
      if (flow.active) continue;
      if (now - flow.lastSeen > RECENT_MS) {
        this.flows.delete(key);
        continue;
      }
      if (!inactive.has(flow.app)) inactive.set(flow.app, []);
      inactive.get(flow.app).push([key, flow.lastSeen]);
    }
    for (const entries of inactive.values()) {
      if (entries.length <= MAX_INACTIVE_DESTINATIONS) continue;
      entries.sort((a, b) => b[1] - a[1]);
      for (const [key] of entries.slice(MAX_INACTIVE_DESTINATIONS)) this.flows.delete(key);
    }
  }

  constructor(onEvent) {
    this.onEvent = onEvent;
    this.pidNames = new Map();      // pid -> exe name
    this.procInfo = new Map();      // exe name (lower) -> { description, path }
    this.icons = new Map();         // exe name (lower) -> base64 png
    this.iconTried = new Set();
    this.dnsNames = new Map();      // ip -> hostname the app asked for (from the DNS cache)
    this.ptr = new Map();           // ip -> reverse-DNS hostname or null
    this.ptrPending = new Set();
    this.flows = new Map();         // `${app}|${ip}` -> flow
    this.dailyReport = new DailyNetworkReport();
    this.foreground = new ForegroundWatcher();
    this.seenCompanies = new SeenCompanies();
    this.previousSockets = null;
    this.links = new Map();         // `${a}|${b}` -> local app-to-app link
    this.dnsCacheAvailable = null;
    this.processRefresh = null;
    this.dnsRefresh = null;
    this.firstPoll = true;
    this.tick = 0;
  }

  async refreshProcessInfo() {
    const list = (await ps('procinfo.ps1')) ?? [];
    for (const p of [].concat(list)) {
      if (!p || !p.ProcessName) continue;
      const key = (p.ProcessName + '.exe').toLowerCase();
      const prev = this.procInfo.get(key) || {};
      this.procInfo.set(key, { description: p.Description || prev.description, path: p.Path || prev.path });
    }
    const missing = [...this.procInfo.entries()]
      .filter(([k, v]) => v.path && !this.iconTried.has(k))
      .map(([k, v]) => [k, v.path]);
    if (missing.length) {
      const icons = (await ps('icons.ps1', JSON.stringify(missing.map(([, p]) => p)))) ?? {};
      for (const [k, p] of missing) {
        this.iconTried.add(k);
        if (icons[p]) this.icons.set(k, icons[p]);
      }
    }
  }

  async refreshDnsCache() {
    const list = [].concat((await ps('dnscache.ps1')) ?? []);
    const names = new Map();
    for (const r of list) {
      if (!r || !r.Data || (r.Type !== 1 && r.Type !== 28)) continue;
      const host = (r.Entry || r.Name || '').toLowerCase();
      if (host) names.set(normalizeIp(r.Data.toLowerCase()), host);
    }
    this.dnsNames = names;
    this.dnsCacheAvailable = names.size > 0;
  }

  lookupPtr(ip) {
    if (this.ptr.has(ip) || this.ptrPending.has(ip) || this.ptrPending.size >= MAX_PTR_LOOKUPS) return;
    this.ptrPending.add(ip);
    dns.lookupService(ip, 0)
      .then(({ hostname }) => hostname && hostname !== ip ? hostname.toLowerCase() : null, () => null)
      .then((name) => { this.ptr.set(ip, name); this.ptrPending.delete(ip); });
  }

  describeIp(ip) {
    const host = this.dnsNames.get(ip.toLowerCase()) || this.ptr.get(ip) || null;
    const geo = geoip.lookup(ip.replace(/^::ffff:/i, ''));
    const asn = lookupAsn(ip);
    const org = orgForHost(host) || (asn && asn.org) || (host ? baseDomain(host) : null);
    const category = trackerCategory(org) ?? trackerCategory(asn?.rawOrg);
    return {
      host,
      org: org || 'Unknown owner',
      network: asn ? asn.rawOrg : null,
      asn: asn ? asn.asn : null,
      tracker: isTracker(host) || category !== null,
      trackerCategory: category,
      country: geo ? geo.country : null,
      city: geo ? geo.city : null,
      lat: geo ? geo.ll[0] : null,
      lng: geo ? geo.ll[1] : null,
      hostSource: this.dnsNames.has(ip.toLowerCase()) ? 'dns' : (this.ptr.get(ip) ? 'reverse-dns' : null),
    };
  }

  appFor(pid) {
    const exe = this.pidNames.get(pid) || (pid === 4 ? 'System' : `pid-${pid}`);
    const key = exe.toLowerCase().endsWith('.exe') ? exe.toLowerCase() : (exe + '.exe').toLowerCase();
    const info = this.procInfo.get(key) || {};
    return { id: key, name: friendlyAppName(exe, info.description) };
  }

  async poll() {
    this.foreground.current();
    this.tick++;
    if (!this.processRefresh && (this.tick === 1 || this.tick % 8 === 0)) {
      this.processRefresh = this.refreshProcessInfo().catch(() => {}).finally(() => { this.processRefresh = null; });
    }
    if (!this.dnsRefresh && (this.tick === 1 || this.tick % (this.dnsCacheAvailable ? 10 : 30) === 0)) {
      this.dnsRefresh = this.refreshDnsCache().catch(() => {}).finally(() => { this.dnsRefresh = null; });
    }
    const [conns, names] = await Promise.all([readConnections(), readTasklist()]);
    // A process can open a socket after the concurrent tasklist snapshot was taken.
    const missing = new Set(conns
      .filter(({ state, pid }) => (state === 'ESTABLISHED' || state === 'SYN_SENT') && pid > 4 && !names.has(pid))
      .map(({ pid }) => pid));
    if (missing.size) {
      const retry = await readTasklist().catch(() => new Map());
      for (const pid of missing) {
        if (retry.has(pid)) names.set(pid, retry.get(pid));
      }
    }
    await this.applyConnections(conns, names, Date.now());
  }

  async applyConnections(conns, names, now) {
    this.pidNames = names;
    const foregroundPid = this.foreground.current(now);
    const foregroundApp = names.has(foregroundPid) ? this.appFor(foregroundPid).id : null;
    const sockets = new Set();
    const openedInBackground = new Map();
    const backgroundApps = new Set();

    // Outbound connections to the internet
    for (const flow of this.flows.values()) flow.sockets = 0;
    for (const c of conns) {
      if (c.state !== 'ESTABLISHED' && c.state !== 'SYN_SENT') continue;
      const ip = c.remote.ip;
      if (isLoopback(ip) || isUnspecified(ip) || isPrivate(ip) || c.pid === 0) continue;
      const app = this.appFor(c.pid);
      if (foregroundApp && names.has(c.pid) && app.id !== foregroundApp) backgroundApps.add(app.id);
      const socket = `${c.pid}|${socketKey(c.local, c.remote)}`;
      if (foregroundApp && names.has(c.pid) && app.id !== foregroundApp &&
          this.previousSockets && !this.previousSockets.has(socket) && !sockets.has(socket)) {
        if (!openedInBackground.has(app.id)) openedInBackground.set(app.id, []);
        openedInBackground.get(app.id).push(ip);
      }
      sockets.add(socket);
      const key = `${app.id}|${ip}`;
      let flow = this.flows.get(key);
      if (!flow) {
        flow = { app: app.id, appName: app.name, ip, ports: new Set(), firstSeen: now, sockets: 0 };
        this.flows.set(key, flow);
        flow.isNew = !this.firstPoll;
      }
      if (!this.dnsNames.has(ip)) this.lookupPtr(ip);
      flow.appName = app.name;
      flow.ports.add(c.remote.port);
      flow.lastSeen = now;
      flow.active = true;
      flow.sockets++;
    }
    this.previousSockets = sockets;
    for (const flow of this.flows.values()) {
      if (flow.sockets === 0) flow.active = false;
    }
    this.pruneInactive(now);
    const dailyApps = this.dailyReport.forDay(now);
    const descriptions = new Map();
    for (const flow of this.flows.values()) {
      if (!flow.active) continue;
      if (!descriptions.has(flow.ip)) descriptions.set(flow.ip, this.describeIp(flow.ip));
      const destination = descriptions.get(flow.ip);
      this.dailyReport.observe(dailyApps, flow.app, flow.appName, destination);
      if (this.seenCompanies.observe(destination.org, now)) {
        flow.firstNewOrg = destination.org;
        this.onEvent({ type: 'new-company', app: flow.appName, appId: flow.app,
          org: destination.org, tracker: destination.tracker, country: destination.country, at: now });
      }
    }
    for (const [id, ips] of openedInBackground) {
      const app = dailyApps.get(id);
      const companies = new Set();
      for (const ip of ips) {
        const destination = descriptions.get(ip);
        if (destination.org === 'Unknown owner') continue;
        companies.add(destination.org);
        app.background.companies.add(destination.org);
        if (destination.tracker) app.background.trackers.add(destination.org);
      }
      app.background.connections += ips.length;
      this.onEvent({ type: 'background-talk', app: app.name, appId: id, connections: ips.length,
        companies: [...companies], at: now });
    }
    const previous = this.backgroundSample;
    if (previous?.day === this.dailyReport.day && now - previous.at <= 4000) {
      for (const id of backgroundApps) {
        if (previous.apps.has(id)) dailyApps.get(id).background.milliseconds += now - previous.at;
      }
    }
    this.backgroundSample = { at: now, day: this.dailyReport.day, apps: backgroundApps };
    const recentIps = new Set([...this.flows.values()].map((flow) => flow.ip));
    for (const ip of this.ptr.keys()) if (!recentIps.has(ip)) this.ptr.delete(ip);
    for (const flow of this.flows.values()) {
      if (!flow.isNew) continue;
      flow.isNew = false;
      const d = this.describeIp(flow.ip);
      this.onEvent({ type: 'new-destination', app: flow.appName, org: d.org, host: d.host, country: d.country, tracker: d.tracker, at: now });
    }

    // Both sides of a local connection appear in netstat. Match the reversed endpoint pair.
    const localSockets = new Map();
    const listeners = new Map();
    for (const c of conns) {
      if (c.state === 'LISTENING') listeners.set(`${c.local.ip}|${c.local.port}`, c.pid);
      if (c.state === 'ESTABLISHED' && c.pid && isLoopback(c.local.ip) && isLoopback(c.remote.ip)) {
        localSockets.set(socketKey(c.local, c.remote), c);
      }
    }
    const seenLinks = new Set();
    for (const [key, c] of localSockets) {
      const reverse = socketKey(c.remote, c.local);
      if (key >= reverse) continue;
      const peer = localSockets.get(reverse);
      if (!peer || peer.pid === c.pid) continue;
      const a = this.appFor(c.pid), b = this.appFor(peer.pid);
      if (a.id === b.id) continue;
      const [x, y] = [a, b].sort((p, q) => p.id.localeCompare(q.id));
      const linkKey = `${x.id}|${y.id}`;
      seenLinks.add(linkKey);
      let link = this.links.get(linkKey);
      if (!link) {
        link = { from: x.id, to: y.id, fromName: x.name, toName: y.name, firstSeen: now, ports: new Set() };
        this.links.set(linkKey, link);
        if (!this.firstPoll) this.onEvent({ type: 'new-link', from: a.name, to: b.name, at: now });
      }
      const endpoints = [c, peer];
      const servers = endpoints.filter(({ local, pid }) =>
        listeners.get(`${local.ip}|${local.port}`) === pid ||
        listeners.get(`0.0.0.0|${local.port}`) === pid ||
        listeners.get(`::|${local.port}`) === pid);
      for (const socket of servers.length ? servers : endpoints) link.ports.add(socket.local.port);
      link.fromName = x.name;
      link.toName = y.name;
      link.lastSeen = now;
      link.active = true;
    }
    for (const [key, link] of this.links) {
      if (!seenLinks.has(key)) link.active = false;
      if (now - link.lastSeen > RECENT_MS) this.links.delete(key);
    }

    this.firstPoll = false;
    await this.seenCompanies.save();
  }

  snapshot() {
    const dailyApps = this.dailyReport.forDay(Date.now());
    const apps = new Map();
    const orgApps = new Map(); // org -> Map(app id, whether its connection is active)
    const descriptions = new Map();
    for (const flow of this.flows.values()) {
      if (!descriptions.has(flow.ip)) descriptions.set(flow.ip, this.describeIp(flow.ip));
      const d = descriptions.get(flow.ip);
      if (!apps.has(flow.app)) {
        apps.set(flow.app, { id: flow.app, name: flow.appName, icon: this.icons.get(flow.app) || null, destinations: [], localPeers: [] });
      }
      apps.get(flow.app).destinations.push({
        ip: flow.ip, ports: [...flow.ports], active: flow.active, sockets: flow.sockets,
        firstSeen: flow.firstSeen, lastSeen: flow.lastSeen, ...d, firstSeenEver: flow.firstNewOrg === d.org,
      });
      if (d.org !== 'Unknown owner') {
        if (!orgApps.has(d.org)) orgApps.set(d.org, new Map());
        const connected = orgApps.get(d.org);
        connected.set(flow.app, flow.active || connected.get(flow.app) === true);
      }
    }
    const links = [];
    for (const link of this.links.values()) {
      for (const [id, name] of [[link.from, link.fromName], [link.to, link.toName]]) {
        if (!apps.has(id)) apps.set(id, { id, name, icon: this.icons.get(id) || null, destinations: [], localPeers: [] });
      }
      apps.get(link.from).localPeers.push(link.to);
      apps.get(link.to).localPeers.push(link.from);
      links.push({ kind: 'local', from: link.from, to: link.to, active: link.active, ports: [...link.ports] });
    }
    // Apps that both send data to the same company
    for (const [org, connected] of orgApps) {
      const list = [...connected.keys()].sort();
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        links.push({ kind: 'shared', from: list[i], to: list[j], via: org, active: connected.get(list[i]) && connected.get(list[j]) });
      }
    }
    for (const app of apps.values()) {
      app.destinations.sort((a, b) => (b.active - a.active) || (b.tracker - a.tracker) || (b.sockets - a.sockets));
      app.activeConnections = app.destinations.filter((d) => d.active).reduce((s, d) => s + d.sockets, 0);
      app.companies = new Set(app.destinations.filter((d) => d.org !== 'Unknown owner').map((d) => d.org)).size;
      app.trackers = app.destinations.filter((d) => d.tracker).length;
      const background = dailyApps.get(app.id)?.background ?? backgroundSummary();
      app.background = { connections: background.connections, companies: [...background.companies], trackers: [...background.trackers] };
    }
    return {
      apps: [...apps.values()].sort((a, b) => b.activeConnections - a.activeConnections || b.destinations.length - a.destinations.length),
      links,
      dnsCacheAvailable: this.dnsCacheAvailable,
    };
  }
}

module.exports = { NetworkWatcher };
