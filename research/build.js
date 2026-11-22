const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { buildIndex } = require('./index');

const run = promisify(execFile);
const root = path.join(__dirname, '..');
const output = path.join(root, 'public', 'data', 'research.json');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const flat = (text) => text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/\s+/g, ' ').trim();

async function pdfText(bytes) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'outbound-source-'));
  const file = path.join(directory, 'source.pdf');
  try {
    await fs.writeFile(file, bytes);
    const { stdout } = await run('pdftotext.exe', ['-enc', 'UTF-8', file, '-'], {
      windowsHide: true, timeout: 12000, maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
  } finally {
    await fs.rm(file, { force: true });
    await fs.rmdir(directory);
  }
}

async function verify(url, terms) {
  if (!url.startsWith('https://')) throw new Error('Source must use HTTPS');
  const { stdout } = await run('curl.exe', ['-fsSL', '--proto', '=https', '--proto-redir', '=https',
    '--max-time', '20', '--max-redirs', '6', '-A', userAgent, url],
    { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024, windowsHide: true })
    .catch((error) => { throw new Error(String(error.stderr || error.code).trim().slice(0, 250)); });
  const pdf = stdout.subarray(0, 5).toString() === '%PDF-';
  const html = pdf ? '' : stdout.toString('utf8');
  const content = pdf ? (await pdfText(stdout)).replace(/\s+/g, ' ').trim() : flat(html);
  if (!content || /^(access denied|just a moment|attention required)/i.test(content)) throw new Error('No policy text');
  const normalized = content.toLowerCase();
  const missing = terms.filter((term) => !normalized.includes(term.toLowerCase()));
  if (missing.length) throw new Error('missing evidence: ' + missing.join(', '));
  return { fetchedAt: new Date().toISOString(),
    title: flat(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 150),
    evidence: terms.map((term) => {
      const i = normalized.indexOf(term.toLowerCase());
      return content.slice(Math.max(0, i - 24), i + term.length + 34);
    }) };
}

async function main() {
  const batch = process.argv[2];
  if (!/^(apps|companies|incidents|facts)-\d+$/.test(batch || '')) throw new Error('Supply a catalog batch such as apps-01.');
  const entries = require('./' + batch);
  let dossier;
  try { dossier = JSON.parse(await fs.readFile(output, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    dossier = { version: 2, method: 'Publisher and regulator sources verified with HTTPS curl and evidence terms.', apps: [], companies: [] };
  }
  const checks = new Map();
  const rejected = [];
  const isExtra = /^(incidents|facts)/.test(batch);
  let accepted = 0;
  const verified = async (url, terms) => {
    const key = JSON.stringify([url, terms]);
    if (!checks.has(key)) checks.set(key, verify(url, terms));
    return checks.get(key);
  };
  for (let i = 0; i < entries.length; i += 8) {
    const results = await Promise.allSettled(entries.slice(i, i + 8).map(async (row) => {
      if (isExtra) {
        const { url, terms, publisher, date, section, claim } = row;
        const result = await verified(url, terms);
        console.log(row.id + ' | ' + result.evidence.join(' | '));
        return { section, ...claim, source: { title: result.title || claim.title || publisher,
          publisher, url, date: date || null, verified: true, fetchedAt: result.fetchedAt } };
      }
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
        rejected.push('- ' + (isExtra ? row.id + ' — ' + row.url : row[1] + ' — ' + row[6]) + ' — ' + result.reason.message);
        continue;
      }
      const entry = result.value;
      if (isExtra) {
        const items = row.company ? dossier.companies : dossier.apps;
        const identity = row.company ? 'name' : 'id';
        let target = items.find((item) => item[identity] === row.id);
        if (!target && row.creation) {
          const [name, publisher, category, domain] = row.creation;
          target = row.company ? { name, aliases: [], hq: { city: null, country: null }, declared: [], incidents: [] } :
            { id: row.id, name, publisher, category, processNames: [], domains: [domain],
              hq: { city: null, country: null }, declared: [], sharesWith: [], destinations: [], incidents: [] };
          items.push(target);
        }
        if (!target) { rejected.push('- ' + row.id + ' — no verified parent entry'); continue; }
        const { section, ...claim } = entry;
        if (row.company && row.aliases) target.aliases = [...new Set([...target.aliases, ...row.aliases])];
        const key = section === 'incidents' ? 'title' : section === 'destinations' ? 'country' : 'party';
        target[section] = (target[section] || []).filter((existing) => existing[key] !== claim[key]);
        target[section].push(claim);
      } else if (batch.startsWith('companies')) {
        const previous = dossier.companies.find((company) => company.name === entry.name);
        dossier.companies = dossier.companies.filter((company) => company.name !== entry.name);
        dossier.companies.push({ name: entry.name, aliases: previous?.aliases || [], hq: entry.hq,
          incidents: previous?.incidents || [], declared: entry.declared,
          ...(previous?.destinations ? { destinations: previous.destinations } : {}) });
      } else {
        const previous = dossier.apps.find((app) => app.id === entry.id);
        if (previous) {
          entry.incidents = previous.incidents;
          entry.sharesWith = previous.sharesWith;
          entry.destinations = previous.destinations;
        }
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
    dossier.index = buildIndex(dossier.apps);
    await fs.writeFile(output, JSON.stringify(dossier, null, 2) + '\n');
  }
  console.log('Accepted ' + accepted + ' of ' + entries.length + ' in ' + batch);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
