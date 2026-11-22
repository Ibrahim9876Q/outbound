const fs = require('node:fs');
const path = require('node:path');
const dossier = require('../public/data/research.json');

const records = [...dossier.apps, ...dossier.companies];
const incidents = records.reduce((sum, record) => sum + record.incidents.length, 0);
const fields = ['declared', 'sharesWith', 'destinations', 'incidents'];
const sources = new Set(records.flatMap((record) =>
  fields.flatMap((field) => (record[field] ?? []).map((entry) => entry.source?.url).filter(Boolean))));

const file = path.join(__dirname, '..', 'README.md');
const readme = fs.readFileSync(file, 'utf8');
const block = /<!-- dossier-counts:start -->\r?\n[^\r\n]*\r?\n<!-- dossier-counts:end -->/g;
if ([...readme.matchAll(block)].length !== 1) throw new Error('Expected one dossier count block in README.md');
const newline = readme.includes('\r\n') ? '\r\n' : '\n';
const line = `The dossier contains **${dossier.apps.length} apps**, **${dossier.companies.length} companies**, ` +
  `and **${incidents} incident records**, with **${sources.size} distinct source URLs** across its records.`;
const updated = readme.replace(block, ['<!-- dossier-counts:start -->', line, '<!-- dossier-counts:end -->'].join(newline));
if (updated !== readme) fs.writeFileSync(file, updated);
console.log(line.replaceAll('**', ''));
