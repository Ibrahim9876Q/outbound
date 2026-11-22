const fs = require('node:fs');
const path = require('node:path');
const { domainToASCII } = require('node:url');
const { isIP } = require('node:net');

const rules = new Set();
for (const line of fs.readFileSync(path.join(__dirname, 'public-suffix-list.dat'), 'utf8').split(/\r?\n/)) {
  const rule = line.trim();
  if (rule && !rule.startsWith('//')) {
    const prefix = rule.startsWith('*.') ? '*.' : rule.startsWith('!') ? '!' : '';
    rules.add(prefix + domainToASCII(rule.slice(prefix.length)));
  }
}

function hostname(host) {
  const ascii = domainToASCII(host.trim().replace(/^\./, '').replace(/\.$/, ''));
  if (!ascii || isIP(ascii) || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(ascii)) return null;
  return ascii;
}

function registrableDomain(host) {
  const labels = hostname(host)?.split('.');
  if (!labels) return null;
  let suffix = 1;
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join('.');
    if (rules.has('!' + candidate)) return candidate;
    if (rules.has(candidate)) suffix = Math.max(suffix, labels.length - i);
    if (i > 0 && rules.has('*.' + candidate)) suffix = Math.max(suffix, labels.length - i + 1);
  }
  return labels.length > suffix ? labels.slice(-suffix - 1).join('.') : null;
}

function aggregateHistory(rows) {
  const domains = new Map();
  for (const row of rows) {
    const url = URL.parse(row.url);
    if (url?.protocol !== 'https:' && url?.protocol !== 'http:') continue;
    const domain = registrableDomain(url.hostname);
    if (!domain || row.visits <= 0) continue;
    const existing = domains.get(domain) ?? { domain, visits: 0, lastVisit: null, trackers: [] };
    existing.visits += row.visits;
    if (row.lastVisit > (existing.lastVisit ?? 0)) existing.lastVisit = row.lastVisit;
    domains.set(domain, existing);
  }
  return [...domains.values()].sort((a, b) => b.visits - a.visits || a.domain.localeCompare(b.domain));
}

module.exports = { hostname, registrableDomain, aggregateHistory };
