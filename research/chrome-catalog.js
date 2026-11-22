const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildIndex } = require('./index');

const run = promisify(execFile);
const base = 'https://chromewebstore.google.com';
const file = path.join(__dirname, '../public/data/research.json');
const directIds = [
  'bmnlcjabgnpnenekpadlanbbkooimhnj', // PayPal Honey
  'gomekmidlodglbbmalcneegieacbdmki', // Avast Online Security
  'gkojfkhlekighikafcpjkiklfbnlmeio', // Hola VPN
  'eppiocemhmnlbhjplcgkofciiegomcon', // Urban VPN
];
const plain = (value) => value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;|&#x27;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
async function get(url) {
  const { stdout } = await run('curl.exe', ['-fsSL', '--proto', '=https', '--proto-redir', '=https',
    '--max-time', '18', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', url],
  { windowsHide: true, maxBuffer: 12 * 1024 * 1024 });
  return stdout;
}

async function verify(extensionId) {
  const url = base + '/detail/' + extensionId;
  const html = await get(url);
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
  const title = plain(/<title>([^<]+)<\/title>/.exec(html)?.[1] || '');
  if (!canonical?.startsWith(base + '/detail/') || !canonical.endsWith('/' + extensionId) ||
      !title.endsWith(' - Chrome Web Store')) throw new Error('Listing identity could not be verified');
  const name = title.replace(/ - Chrome Web Store$/, '');
  const publisher = plain(/>Developer<\/div><div><div[^>]*><div class="mdSapd">([^<]+)/.exec(html)?.[1] || '');
  if (!publisher || publisher.includes('@')) throw new Error('No public developer name');
  const block = /handles the following:<\/h3>([\s\S]*?)(?=<div class="qvYEAf"|<\/section>)/.exec(html)?.[1] || '';
  const fields = [...new Set([...block.matchAll(/<span class="jnapE">([^<]+)<\/span>/g)].map(([, field]) => plain(field)))];
  const noCollection = /developer has disclosed that it will not collect or use your data/i.test(html);
  if (!fields.length && !noCollection) throw new Error('No verifiable publisher privacy label');
  return {
    id: 'extension-' + extensionId, extensionIds: [extensionId], name, publisher, category: 'browser extension',
    domains: [], processNames: [], hq: { city: null, country: null }, incidents: [], destinations: [], sharesWith: [],
    declared: [{ data: fields.length ? fields.join(', ') : 'Developer declares no collection or use',
      purpose: 'Publisher disclosure on its Chrome Web Store listing.',
      source: { title, publisher, url: canonical, date: null, verified: true, fetchedAt: new Date().toISOString() } }],
  };
}

async function main() {
  const dossier = JSON.parse(await fs.readFile(file, 'utf8'));
  const limit = Number(process.argv[2] || 20);
  const known = new Set(dossier.apps.flatMap((app) => app.extensionIds || []));
  const rejects = [];
  const rejectFile = path.join(__dirname, 'rejected.md');
  const history = await fs.readFile(rejectFile, 'utf8');
  const rejected = new Set([...history.matchAll(/https:\/\/chromewebstore\.google\.com\/detail\/([a-p]{32})\s+—/g)].map(([, id]) => id));
  const charts = await Promise.allSettled(['popular', 'notable'].map((chart) => get(base + '/top-charts/' + chart)));
  const leads = [...new Set([...directIds, ...charts.flatMap((result) => result.status === 'fulfilled'
    ? [...result.value.matchAll(/href="\.\/detail\/[^"/]+\/([a-p]{32})"/g)].map(([, id]) => id) : [])])]
    .filter((id) => !known.has(id) && !rejected.has(id));
  let accepted = 0;
  for (let i = 0; i < leads.length && accepted < limit; i += 8) {
    const batch = leads.slice(i, i + 8);
    const results = await Promise.allSettled(batch.map(verify));
    for (let j = 0; j < results.length && accepted < limit; j++) {
      const result = results[j];
      if (result.status === 'rejected') rejects.push('- ' + base + '/detail/' + batch[j] + ' — ' + result.reason.message.split('\n')[0]);
      else {
        dossier.apps.push(result.value);
        console.log(result.value.name + ' | ' + result.value.publisher);
        accepted++;
      }
    }
  }
  if (rejects.length) await fs.appendFile(rejectFile, '\n## Chrome Web Store leads\n\n' + rejects.join('\n') + '\n');
  dossier.generatedAt = new Date().toISOString();
  dossier.index = buildIndex(dossier.apps);
  await fs.writeFile(file, JSON.stringify(dossier, null, 2) + '\n');
  console.log('Accepted ' + accepted + ' of ' + leads.length + ' extension leads.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
