const assert = require('node:assert/strict');
const { test } = require('node:test');
const dossier = require('../public/data/research.json');
const { buildIndex } = require('./index');

function date(value) { assert.ok(typeof value === 'string' && Number.isFinite(Date.parse(value))); }
function str(value) { assert.ok(typeof value === 'string' && value.trim()); }
function source(value) {
  assert.equal(value.verified, true);
  assert.equal(new URL(value.url).protocol, 'https:');
  str(value.title);
  str(value.publisher);
  date(value.fetchedAt);
  if (value.date !== null) date(value.date);
  for (const alternate of value.alternates || []) {
    assert.equal(alternate.verified, true);
    assert.equal(new URL(alternate.url).protocol, 'https:');
    assert.notEqual(alternate.url, value.url);
    str(alternate.title);
    date(alternate.fetchedAt);
  }
}
function headquarters(value) {
  for (const key of ['city', 'country']) if (value[key] !== null) str(value[key]);
}
function claims(rows, fields) {
  assert.ok(Array.isArray(rows));
  for (const row of rows) {
    for (const key of fields) str(row[key]);
    source(row.source);
  }
}
function incidents(rows) {
  claims(rows, ['title', 'jurisdiction', 'summary']);
  for (const row of rows) {
    assert.ok(['court', 'settlement', 'fine', 'regulator', 'investigation', 'report', 'breach'].includes(row.kind));
    assert.ok(Number.isInteger(row.year));
    if (row.amount !== undefined) str(row.amount);
    if (row.quote !== undefined || row.quoteSource !== undefined) {
      str(row.quote);
      assert.ok(row.quote.trim().split(/\s+/).length <= 25);
      source(row.quoteSource);
      assert.match(row.quoteSource.date, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
}
test('dossier v2 has a verified HTTPS source for every claim and every entry', () => {
  assert.equal(dossier.version, 2);
  str(dossier.method);
  date(dossier.generatedAt);
  assert.ok(dossier.apps.length);
  assert.equal(new Set(dossier.apps.map((app) => app.id)).size, dossier.apps.length);
  assert.equal(new Set(dossier.companies.map((company) => company.name)).size, dossier.companies.length);
  for (const app of dossier.apps) {
    for (const key of ['id', 'name', 'publisher', 'category']) str(app[key]);
    assert.ok(app.processNames.every((value) => /\.exe$/i.test(value)));
    assert.ok(app.domains.every((value) => /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(value)));
    if (app.extensionIds) {
      for (const id of app.extensionIds) assert.match(id, /^[a-p]{32}$/);
      assert.ok(app.extensionIds.length);
    }
    headquarters(app.hq);
    claims(app.declared, ['data', 'purpose']);
    claims(app.sharesWith, ['party', 'purpose']);
    claims(app.destinations, ['country', 'note']);
    incidents(app.incidents);
    assert.ok(app.declared.length + app.sharesWith.length + app.destinations.length + app.incidents.length);
  }
  for (const company of dossier.companies) {
    str(company.name);
    company.aliases.forEach(str);
    headquarters(company.hq);
    claims(company.declared, ['data', 'purpose']);
    if (company.sharesWith) claims(company.sharesWith, ['party', 'purpose']);
    if (company.destinations) claims(company.destinations, ['country', 'note']);
    incidents(company.incidents);
    assert.ok(company.declared.length + company.incidents.length +
      (company.sharesWith?.length || 0) + (company.destinations?.length || 0));
  }
});

test('twenty incident excerpts have dated primary citations and a 25-word cap', () => {
  const quotes = [...dossier.apps, ...dossier.companies].flatMap((item) => item.incidents).filter((item) => item.quote);
  assert.equal(quotes.length, 20);
});

test('each cited URL was checked and each unavailable original has a verified reachable alternate', () => {
  const health = require('./link-health.json');
  const citations = require('./link-health').sources(dossier);
  for (const item of citations) {
    assert.ok(health[item.url], item.url);
    date(health[item.url].checkedAt);
    const reachable = (url) => health[url]?.status === 'reachable';
    for (const alternate of item.alternates || []) assert.ok(reachable(alternate.url), alternate.url);
    assert.ok(reachable(item.url) || item.alternates?.some((alternate) => reachable(alternate.url)), item.url);
  }
});

test('dossier index maps executable and domain keys to stable app IDs', () => {
  assert.deepEqual(dossier.index, buildIndex(dossier.apps));
  assert.ok(dossier.index.exe['discord.exe'].includes('discord'));
  assert.ok(dossier.index.domain['discord.com'].includes('discord'));
  assert.ok(dossier.index.domain['google.com'].length > 1);
  const honeyId = 'bmnlcjabgnpnenekpadlanbbkooimhnj';
  assert.deepEqual(dossier.index.extension[honeyId], ['extension-' + honeyId]);
  for (const [extensionId, matches] of Object.entries(dossier.index.extension)) {
    assert.match(extensionId, /^[a-p]{32}$/);
    assert.equal(matches.length, 1);
  }
});
