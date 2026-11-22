const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fetchSource } = require('./build');

const sections = ['declared', 'sharesWith', 'destinations', 'incidents'];
const identityFields = { declared: 'data', sharesWith: 'party', destinations: 'country', incidents: 'title' };
const auditFile = path.join(__dirname, 'incident-evidence.json');
const norm = (text) => String(text).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

function canonical(source) {
  const url = new URL(source.url);
  url.hostname = url.hostname.replace(/^www\./, '');
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.*|trk|wbdisable|msockid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/$/, '') || '/';
  return url.href;
}

function claims(dossier) {
  return [...dossier.apps, ...dossier.companies].flatMap((entity) =>
    sections.flatMap((section) => (entity[section] || []).map((row) => ({
      entity: entity.id || entity.name, section, row, url: canonical(row.source),
    }))));
}

function checkStructure(dossier) {
  const seenClaims = new Set();
  const seenCases = new Set();
  const seenIncidents = new Set();
  const seenSingleCaseSources = new Set();
  for (const { entity, section, row, url } of claims(dossier)) {
    const claim = JSON.stringify([entity, section, norm(row[identityFields[section]]), url]);
    assert.ok(!seenClaims.has(claim), 'Duplicate source for claim ' + claim);
    seenClaims.add(claim);
    assert.equal(row.source.verified, true, claim);
    assert.ok(typeof row.source.fetchedAt === 'string' && Number.isFinite(Date.parse(row.source.fetchedAt)), claim);
    if (section !== 'incidents') continue;
    const title = norm(row.title);
    assert.ok(!seenIncidents.has(title), 'Duplicate incident title ' + row.title);
    seenIncidents.add(title);
    if (row.caseRef) {
      const caseId = norm(row.caseRef);
      assert.ok(!seenCases.has(caseId), 'Duplicate case reference ' + row.caseRef);
      seenCases.add(caseId);
    }
    // The Irish regulator's register contains many separate matters on one page.
    if (!new URL(url).pathname.endsWith('/decisions/fines')) {
      assert.ok(!seenSingleCaseSources.has(url), 'Duplicate incident source ' + url);
      seenSingleCaseSources.add(url);
    }
  }
}

function yearEvidence({ content, html }, item) {
  if (item.title.endsWith('FTC case record')) {
    const timeline = /Case Timeline\s*<\/h2>([\s\S]*)/i.exec(html)?.[1] || '';
    return [...timeline.matchAll(/\bdatetime="([\d-]{10})T/g)].map(([, date]) => date).sort()[0] || null;
  }
  const year = new RegExp('\\b' + item.year + '\\b');
  if (year.test(content)) return String(item.year);
  const filed = /Filed:?\s+(\d\d)\/(\d\d)\/(\d\d)\b/i.exec(content);
  return filed && Number(filed[3]) === item.year % 100 ? item.year + '-' + filed[1] + '-' + filed[2] : null;
}

function moneyValue(text) {
  const normalized = norm(text).replace(/(?<=\d)[,\s](?=\d{3}(?:\D|$))/g, '');
  const currency = /€|\beuros?\b|\beur\b/.test(normalized) ? 'EUR'
    : /£|\bpounds?\b|\bgbp\b/.test(normalized) ? 'GBP'
      : /\b(?:sek|kronor)\b/.test(normalized) ? 'SEK'
        : /\$|\busd\b|\bdollars?\b/.test(normalized) ? 'USD' : null;
  const amount = normalized.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
  if (!amount || !currency) return null;
  const units = /\b(?:billions?|milliards?|miljarder)\b|\d\s*bn\b/.test(normalized) ? 1e9
    : /\b(?:millions?|miljoner)\b|\d\s*m\b/.test(normalized) ? 1e6 : 1;
  return currency + ':' + Math.round(Number(amount) * units);
}

function amountsIn(content) {
  const text = content.replace(/&#(?:x20ac|8364);|&euro;/gi, '€').replace(/&#(?:x24|36);|&dollar;/gi, '$')
    .replace(/&#(?:xa3|163);|&pound;/gi, '£')
    .replace(/&nbsp;|&#160;|&#x202f;/gi, ' ').replace(/\s+/g, ' ');
  const figure = '\\d+(?:(?:[, ]\\d{3})+|[.,]\\d+)?' +
    '(?:\\s*(?:millions?|billions?|milliards?|miljoner|miljarder|bn|m)\\b)?';
  const candidates = new RegExp('(?:[€$£]|\\b(?:USD|EUR|GBP|SEK)\\b)\\s*' + figure +
    '|\\b' + figure + '\\s+(?:d[\'’])?(?:euros?|dollars?|pounds?|(?:Swedish\\s+)?kronor)\\b', 'gi');
  return [...text.matchAll(candidates)].map(([match]) => match);
}

function amountEvidence(content, amount) {
  const expected = moneyValue(amount);
  return amountsIn(content).find((match) => moneyValue(match) === expected) || null;
}

function summaryAmounts(row) {
  const canonicalAmount = row.amount ? moneyValue(row.amount) : null;
  return [...new Map(amountsIn(row.summary).map((amount) => [moneyValue(amount), amount]))
    .entries()].filter(([amount]) => amount && amount !== canonicalAmount).map(([, amount]) => amount);
}

function auditKey({ entity, row, url }) {
  return JSON.stringify([entity, row.title, url, row.year, row.amount ?? null, ...summaryAmounts(row)]);
}

function checkEvidence(dossier, evidence) {
  const cases = claims(dossier).filter(({ section }) => section === 'incidents');
  assert.equal(Object.keys(evidence).length, cases.length, 'Audit inventory is stale');
  for (const entry of cases) {
    const record = evidence[auditKey(entry)];
    assert.ok(record, 'Missing curl audit for ' + entry.row.title);
    assert.ok(Number.isFinite(Date.parse(record.checkedAt)), entry.row.title);
    assert.ok(!record.error, entry.row.title + ' requires source review: ' + record.error);
    assert.equal(Number(record.year.slice(0, 4)), entry.row.year, entry.row.title);
    if (entry.row.amount) assert.equal(moneyValue(record.amount), moneyValue(entry.row.amount), entry.row.title);
    assert.deepEqual((record.summaryAmounts || []).map(moneyValue), summaryAmounts(entry.row).map(moneyValue), entry.row.title);
  }
}

async function refresh(dossier, output = auditFile) {
  checkStructure(dossier);
  const cases = claims(dossier).filter(({ section }) => section === 'incidents');
  const byUrl = new Map();
  for (const item of cases) {
    const url = item.row.source.url;
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(item);
  }
  const groups = [...byUrl.entries()];
  const evidence = {};
  const previous = process.argv.includes('--reuse') || process.argv.includes('--retry-gaps')
    ? JSON.parse(await fs.readFile(output, 'utf8')) : {};
  for (let i = 0; i < groups.length; i += 32) {
    await Promise.all(groups.slice(i, i + 32).map(async ([url, items]) => {
      if (items.every((item) => {
        const saved = previous[auditKey(item)];
        return saved && (!process.argv.includes('--retry-gaps') || !saved.error);
      })) {
        for (const item of items) evidence[auditKey(item)] = previous[auditKey(item)];
        return;
      }
      const page = await fetchSource(url).catch((error) => ({ error: error.message }));
      for (const item of items) {
        const checkedAt = new Date().toISOString();
        const year = page.error ? null : yearEvidence(page, item.row);
        const amount = !page.error && item.row.amount ? amountEvidence(page.content, item.row.amount) : null;
        const extraAmounts = page.error ? [] : summaryAmounts(item.row).map((value) => amountEvidence(page.content, value));
        const error = page.error || (Number(year?.slice(0, 4)) !== item.row.year && 'Incident year evidence not located') ||
          ((item.row.amount && !amount || extraAmounts.includes(null)) && 'Incident amount evidence not located');
        evidence[auditKey(item)] = error ? { checkedAt, error } : { checkedAt, year, ...(amount && { amount }),
          ...(extraAmounts.length && { summaryAmounts: extraAmounts }) };
      }
    }));
    console.log('Audited source URLs ' + Math.min(i + 32, groups.length) + '/' + groups.length);
  }
  await fs.writeFile(output, JSON.stringify(Object.fromEntries(Object.entries(evidence).sort()), null, 2) + '\n');
  const missing = Object.values(evidence).filter((record) => record.error).length;
  console.log(missing + ' incident records require source review.');
  if (missing && process.argv.includes('--strict')) process.exitCode = 1;
}

if (require.main === module) {
  const dossier = require('../public/data/research.json');
  refresh(dossier).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { checkStructure, checkEvidence };
