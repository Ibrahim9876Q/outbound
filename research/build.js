const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');

const run = promisify(execFile);
const root = path.join(__dirname, '..');
const output = path.join(root, 'public', 'data', 'research.json');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const flat = (text) => text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();

async function verify(url, terms) {
  if (!url.startsWith('https://')) throw new Error('Source must use HTTPS');
  const { stdout } = await run('curl.exe', ['-fsSL', '--proto', '=https', '--proto-redir', '=https',
    '--max-time', '20', '--max-redirs', '6', '-A', userAgent, url], { maxBuffer: 10 * 1024 * 1024, windowsHide: true })
    .catch((error) => { throw new Error(String(error.stderr || error.code).trim().slice(0, 250)); });
  const content = flat(stdout);
  if (!content || /^(access denied|just a moment|attention required)/i.test(content)) throw new Error('No policy text');
  const normalized = content.toLowerCase();
  const missing = terms.filter((term) => !normalized.includes(term.toLowerCase()));
  if (missing.length) throw new Error('missing evidence: ' + missing.join(', '));
  return { fetchedAt: new Date().toISOString(),
    title: flat(stdout.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 150),
    evidence: terms.map((term) => {
      const i = normalized.indexOf(term.toLowerCase());
      return content.slice(Math.max(0, i - 24), i + term.length + 34);
    }) };
}

async function main() {
  const batch = process.argv[2];
  if (!/^(apps|companies|incidents)-\d+$/.test(batch || '')) throw new Error('Supply a catalog batch such as apps-01.');
  const entries = require('./' + batch);
  let dossier;
  try { dossier = JSON.parse(await fs.readFile(output, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    dossier = { version: 2, method: 'Publisher and regulator sources verified with HTTPS curl and evidence terms.', apps: [], companies: [] };
  }
  const checks = new Map();
  const rejected = [];
  let accepted = 0;
  const verified = async (url, terms) => {
    const key = JSON.stringify([url, terms]);
    if (!checks.has(key)) checks.set(key, verify(url, terms));
    return checks.get(key);
  };
  for (let i = 0; i < entries.length; i += 8) {
    const results = await Promise.allSettled(entries.slice(i, i + 8).map(async (row) => {
      const [id, name, publisher, category, processName, domain, url, data, purpose, terms] = row;
      const result = await verified(url, terms);
      const source = { title: result.title || publisher + ' privacy notice', publisher, url, date: null,
        verified: true, fetchedAt: result.fetchedAt };
      console.log(id + ' | ' + result.evidence.join(' | '));
      return { id, name, publisher, category, processNames: processName ? [processName] : [], domains: domain ? [domain] : [],
        hq: { city: null, country: null }, declared: [{ data, purpose, source }], sharesWith: [], destinations: [], incidents: [] };
    }));
    for (const [offset, result] of results.entries()) {
      const row = entries[i + offset];
      if (result.status === 'rejected') {
        rejected.push('- ' + row[1] + ' — ' + row[6] + ' — ' + result.reason.message);
        continue;
      }
      const entry = result.value;
      if (batch.startsWith('companies')) {
        dossier.companies = dossier.companies.filter((company) => company.name !== entry.name);
        dossier.companies.push({ name: entry.name, aliases: [], hq: entry.hq, incidents: entry.incidents, declared: entry.declared });
      } else {
        const previous = dossier.apps.find((app) => app.id === entry.id);
        if (previous) entry.incidents = previous.incidents;
        dossier.apps = dossier.apps.filter((app) => app.id !== entry.id);
        dossier.apps.push(entry);
      }
      accepted++;
    }
  }
  if (rejected.length) await fs.appendFile(path.join(__dirname, 'rejected.md'),
    '\n## ' + batch + ' · ' + new Date().toISOString() + '\n\n' + rejected.join('\n') + '\n');
  if (accepted) {
    dossier.generatedAt = new Date().toISOString();
    await fs.writeFile(output, JSON.stringify(dossier, null, 2) + '\n');
  }
  console.log('Accepted ' + accepted + ' of ' + entries.length + ' in ' + batch);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
