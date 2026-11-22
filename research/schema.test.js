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
    incidents(company.incidents);
    assert.ok(company.declared.length + company.incidents.length);
  }
});

test('dossier index maps executable and domain keys to stable app IDs', () => {
  assert.deepEqual(dossier.index, buildIndex(dossier.apps));
  assert.ok(dossier.index.exe['discord.exe'].includes('discord'));
  assert.ok(dossier.index.domain['discord.com'].includes('discord'));
  assert.ok(dossier.index.domain['google.com'].length > 1);
});
