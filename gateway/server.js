const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const dns = require('node:dns');
const { startDns } = require('./dns');
const { createFga, createCiba } = require('./auth0');
const { createConsent, ConsentError } = require('./consent');
const { createDemo, lookupTracker, DOMAIN } = require('./demo');
const { randomUUID } = require('node:crypto');

const DASHBOARD_PORT = 4320;
const LOOPBACK = '127.0.0.1';
const ROOT = path.join(__dirname, '..');
const ASSETS = {
  '/style.css': ['text/css', path.join(ROOT, 'public', 'style.css')],
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
  const grantMinutes = Number(env.PHONE_GRANT_MINUTES || 15);
  if (!Number.isInteger(grantMinutes) || grantMinutes < 1 || grantMinutes > 1440) {
    throw new Error('PHONE_GRANT_MINUTES must be a whole number from 1 to 1440.');
  }
  const subject = env.AUTH0_USER_ID;
  const domain = env.AUTH0_DOMAIN?.toLowerCase();
  let fga;
  let ciba;
  if ([env.FGA_API_URL, env.FGA_STORE_ID, env.FGA_MODEL_ID, env.FGA_CLIENT_ID, env.FGA_CLIENT_SECRET,
    env.PHONE_POLICY_KEY, domain, subject].every(Boolean)) {
    const api = env.FGA_API_URL.replace(/\/$/, '') + '/';
    if (!/^https:\/\/api\.[a-z0-9-]+\.fga\.dev\/$/.test(api)) throw new Error('Use the regional https FGA API URL.');
    const ulid = /^[0-9A-HJKMNP-TV-Z]{26}$/;
    if (!ulid.test(env.FGA_STORE_ID) || !ulid.test(env.FGA_MODEL_ID)) throw new Error('Set valid FGA store and model IDs.');
    if (!/^[a-f0-9]{64}$/i.test(env.PHONE_POLICY_KEY)) throw new Error('Set PHONE_POLICY_KEY to 32 random bytes in hex.');
    fga = {
      api, store: env.FGA_STORE_ID, model: env.FGA_MODEL_ID, subject: domain + '/' + subject,
      clientId: env.FGA_CLIENT_ID, clientSecret: env.FGA_CLIENT_SECRET, key: Buffer.from(env.PHONE_POLICY_KEY, 'hex'),
    };
  }
  if ([domain, env.AUTH0_CLIENT_ID, env.AUTH0_CLIENT_SECRET, subject].every(Boolean)) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
      throw new Error('AUTH0_DOMAIN must be the Auth0 tenant hostname.');
    }
    ciba = { issuer: 'https://' + domain + '/', clientId: env.AUTH0_CLIENT_ID, clientSecret: env.AUTH0_CLIENT_SECRET, subject };
  }
  return { host, client, port, upstreams, fga, ciba, grantMinutes };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function startGateway(config, { fetch, laptop = false, dashboardPort = DASHBOARD_PORT,
  catalogPath = path.join(ROOT, 'data', 'phone-consent.json') } = {}) {
  const demo = laptop && !(config.fga && config.ciba) ? createDemo() : null;
  const assets = new Map(await Promise.all(Object.entries(ASSETS).map(async ([route, [type, file]]) =>
    [route, { type, body: await fs.readFile(file) }])));
  const stats = { lookups: 0, blocked: 0 };
  const instance = randomUUID();
  const lookups = [];
  const consent = createConsent({
    fga: demo?.fga || (config.fga && createFga(config.fga, fetch)),
    ciba: demo?.ciba || (config.ciba && createCiba(config.ciba, fetch)),
    grantMinutes: config.grantMinutes,
    catalogPath: demo ? null : catalogPath,
  });
  let dnsListener;
  let offlineRun;
  let startingOffline;
  let closed = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (![LOOPBACK + ':' + dashboardPort, 'localhost:' + dashboardPort].includes(req.headers.host)) {
      return json(res, 403, { error: 'Open the dashboard on this PC.' });
    }
    if (req.method === 'POST') {
      if (req.headers.origin !== 'http://' + req.headers.host || req.headers['x-outbound-action'] !== '1') {
        return json(res, 403, { error: 'Use the local Phone view to change tracker permissions.' });
      }
      if (!demo && req.url === '/api/demo/fallback' &&
          consent.snapshot().trackers.some((tracker) => tracker.state === 'failed' && tracker.source === 'CIBA')) {
        if (startingOffline) return json(res, 409, { error: 'The offline demo is already starting.' });
        startingOffline = true;
        try {
          offlineRun?.close();
          offlineRun = await startGateway({ host: LOOPBACK, client: LOOPBACK, port: 0, grantMinutes: 1 },
            { laptop: true, dashboardPort: 0 });
          if (closed) return offlineRun.close();
          return json(res, 200, { port: offlineRun.dashboardPort });
        } catch {
          return json(res, 503, { error: 'Could not start the offline demo.' });
        } finally {
          startingOffline = false;
        }
      }
      if (laptop && req.url === '/api/demo/lookup') {
        try {
          const message = await lookupTracker(dnsListener.port);
          return json(res, 200, { message, blocked: message === 'Lookup blocked.' });
        } catch {
          return json(res, 500, { error: 'Laptop DNS lookup failed.' });
        }
      }
      if (laptop && req.url === '/api/demo/check') {
        try {
          return json(res, 200, { allowed: await consent.verify(DOMAIN) });
        } catch (error) {
          return json(res, 503, { error: error.message });
        }
      }
      if (demo && ['/api/demo/approve', '/api/demo/deny'].includes(req.url)) {
        const accepted = demo.decide(req.url.endsWith('/approve') ? 'approved' : 'denied');
        return accepted ? json(res, 200, { message: 'Demo decision submitted.' }) :
          json(res, 409, { error: 'No pending demo request.' });
      }
      const action = /^\/api\/trackers\/([a-z0-9.-]{1,253})\/(request|revoke)$/.exec(req.url);
      if (!action) return json(res, 404, { error: 'Not found.' });
      try {
        if (action[2] === 'request') return json(res, 202, consent.request(action[1]));
        await consent.revoke(action[1]);
        return json(res, 200, { revoked: true });
      } catch (error) {
        const message = error instanceof ConsentError ? error.message : 'Could not update tracker permissions.';
        return json(res, error instanceof ConsentError ? error.status : 500, { error: message });
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' });
    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }
    if (req.url === '/api/state') {
      return json(res, 200, {
        dns: { host: config.host, port: dnsListener.port },
        instance, stats, lookups, consent: consent.snapshot(), laptop, demo: Boolean(demo), testDomain: laptop ? DOMAIN : null,
      });
    }
    const asset = assets.get(req.url);
    if (!asset) return json(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': asset.type + '; charset=utf-8' });
    res.end(asset.body);
  });

  function close() {
    closed = true;
    offlineRun?.close();
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
      resolve: demo?.resolve,
      onError,
      allowTracker: consent.allowTracker,
      onLookup(event) {
        stats.lookups++;
        if (event.status === 'blocked') stats.blocked++;
        const at = Date.now();
        lookups.unshift({ ...event, at, id: stats.lookups });
        if (lookups.length > 80) lookups.pop();
        if (event.tracker) consent.observe(event.tracker);
      },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(dashboardPort, LOOPBACK, () => {
        dashboardPort = server.address().port;
        server.off('error', reject);
        server.on('error', onError);
        resolve();
      });
    });
  } catch (error) {
    close();
    throw error;
  }
  return { close, dnsPort: dnsListener.port, demo: Boolean(demo), dashboardPort };
}

function printAuthStatus(config, demo) {
  const status = (value) => value ? 'configured' : 'not configured';
  console.log('Auth0 FGA: ' + status(config.fga) + ' CIBA: ' + status(config.ciba) + ' Mode: ' + (demo ? 'demo' : 'live'));
}

async function main() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const laptop = process.argv.includes('--demo');
  const config = readConfig(laptop ? { ...process.env, PHONE_DNS_HOST: LOOPBACK, PHONE_DNS_CLIENT: LOOPBACK,
    PHONE_DNS_PORT: '', PHONE_UPSTREAM_DNS: process.env.PHONE_UPSTREAM_DNS || dns.getServers()[0] || LOOPBACK } : process.env);
  if (laptop) config.port = 0;
  if (laptop && !(config.fga && config.ciba)) config.grantMinutes = 1;
  const gateway = await startGateway(config, { laptop });
  printAuthStatus(config, gateway.demo);
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
