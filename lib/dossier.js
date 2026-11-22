let source;
try { source = require('../public/data/research.json'); } catch { source = {}; }

const key = (value) => typeof value === 'string' ? value.trim().toLowerCase().replace(/\.exe$/i, '').replace(/[^a-z0-9]/g, '') : '';
const exeKey = (value) => key(typeof value === 'string' ? value.split(/[\\/]/).at(-1) : '');
const domainKey = (value) => typeof value === 'string' ? value.toLowerCase().replace(/^\.|\.$/g, '') : '';

function index(entries) {
  const result = new Map();
  for (const [alias, item] of entries) {
    if (alias && result.get(alias) !== item) result.set(alias, result.has(alias) ? null : item);
  }
  return result;
}

const apps = source.apps ?? [];
const names = index(apps.map((app) => [key(app.name), app]));
const exes = index(apps.flatMap((app) => (app.processNames ?? []).map((exe) => [exeKey(exe), app])));
const domains = index(apps.flatMap((app) => (app.domains ?? []).map((domain) => [domainKey(domain), app])));
const companies = index((source.companies ?? []).flatMap((company) =>
  [company.name, ...(company.aliases ?? [])].map((alias) => [key(alias), company])));

function findApp(id, name) { return exes.get(exeKey(id)) ?? names.get(key(name)) ?? null; }
function findCompany(name) { return companies.get(key(name)) ?? null; }
function findDomain(domain) {
  for (let value = domainKey(domain); value.includes('.'); value = value.slice(value.indexOf('.') + 1)) {
    if (domains.has(value)) return domains.get(value);
  }
  return null;
}

module.exports = { key, exeKey, findApp, findCompany, findDomain };
