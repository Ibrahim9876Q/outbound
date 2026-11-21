const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const dns = require('node:dns');
const { startDns } = require('./dns');

const DASHBOARD_PORT = 4320;
const LOOPBACK = '127.0.0.1';
const ROOT = path.join(__dirname, '..');
const ASSETS = {
  '/': ['text/html', path.join(__dirname, 'index.html')],
  '/phone.js': ['text/javascript', path.join(ROOT, 'public', 'phone.js')],
  '/phone.css': ['text/css', path.join(ROOT, 'public', 'phone.css')],
};

function portNumber(value, fallback, name) {
  if (!value) return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(name + ' must be a valid port.');
  return port;
}

function readConfig(env) {
  const host = env.PHONE_DNS_HOST || LOOPBACK;
  const client = env.PHONE_DNS_CLIENT || (host === LOOPBACK ? LOOPBACK : '');
  if (!net.isIPv4(host) || !net.isIPv4(client) || host === '0.0.0.0' || client === '0.0.0.0') {
    throw new Error('Use specific IPv4 addresses for PHONE_DNS_HOST and PHONE_DNS_CLIENT.');
  }
  const port = portNumber(env.PHONE_DNS_PORT, host === LOOPBACK ? 5354 : 53, 'PHONE_DNS_PORT');
  const upstreamPort = portNumber(env.PHONE_UPSTREAM_PORT, 53, 'PHONE_UPSTREAM_PORT');
  const addresses = env.PHONE_UPSTREAM_DNS ? [env.PHONE_UPSTREAM_DNS] : dns.getServers();
  const upstreams = addresses
    .filter((address) => net.isIP(address) && address !== '0.0.0.0' && address !== '::')
    .filter((address) => address !== host || upstreamPort !== port)
    .map((address) => ({ host: address, port: upstreamPort }));
  if (!upstreams.length) throw new Error('Set PHONE_UPSTREAM_DNS to the IPv4 or IPv6 address of a DNS resolver.');
  return { host, client, port, upstreams };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function startGateway(config) {
  const assets = new Map(await Promise.all(Object.entries(ASSETS).map(async ([route, [type, file]]) =>
    [route, { type, body: await fs.readFile(file) }])));
  const stats = { lookups: 0, blocked: 0 };
  const lookups = [];
  const trackers = new Map();
  let dnsListener;
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (!['127.0.0.1:' + DASHBOARD_PORT, 'localhost:' + DASHBOARD_PORT].includes(req.headers.host)) {
      return json(res, 403, { error: 'Open the dashboard on this PC.' });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
    if (req.url === '/api/state') {
      return json(res, 200, {
        dns: { host: config.host, port: dnsListener.port },
        stats, lookups, trackers: [...trackers.values()].reverse(),
      });
    }
    const asset = assets.get(req.url);
    if (!asset) return json(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': asset.type + '; charset=utf-8' });
    res.end(asset.body);
  });

  function close() {
    dnsListener?.close();
    server.close();
    server.closeAllConnections();
  }
  function onError(error) {
    console.error('Gateway listener stopped: ' + (error.code || 'unexpected error'));
    process.exitCode = 1;
    close();
  }
  try {
    dnsListener = await startDns({
      ...config,
      onError,
      allowTracker: async () => false,
      onLookup(event) {
        stats.lookups++;
        if (event.status === 'blocked') stats.blocked++;
        const at = Date.now();
        lookups.unshift({ ...event, at, id: stats.lookups });
        if (lookups.length > 80) lookups.pop();
        if (event.tracker) {
          trackers.delete(event.tracker);
          trackers.set(event.tracker, { domain: event.tracker, org: event.org, at });
        }
      },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(DASHBOARD_PORT, LOOPBACK, () => {
        server.off('error', reject);
        server.on('error', onError);
        resolve();
      });
    });
  } catch (error) {
    close();
    throw error;
  }
  return { close, dnsPort: dnsListener.port };
}

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const config = readConfig(process.env);
  const gateway = await startGateway(config);
  console.log('Outbound Phone at http://' + LOOPBACK + ':' + DASHBOARD_PORT + '/');
  console.log('Phone DNS listening on ' + config.host + ':' + gateway.dnsPort + ' (UDP and TCP)');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Could not start Phone gateway: ' + (error.code || error.message));
    process.exitCode = 1;
  });
}

module.exports = { readConfig, startGateway };
