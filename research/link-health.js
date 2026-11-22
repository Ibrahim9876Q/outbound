const fs = require('node:fs/promises');
const path = require('node:path');
const { fetchSource } = require('./build');

const reportFile = path.join(__dirname, 'link-health.json');
const sections = ['declared', 'sharesWith', 'destinations', 'incidents'];

function sources(dossier) {
  return [...dossier.apps, ...dossier.companies].flatMap((item) =>
    sections.flatMap((section) => (item[section] || []).flatMap((row) =>
      row.quoteSource ? [row.source, row.quoteSource] : [row.source])));
}

async function check(url) {
  try {
    const { content } = await fetchSource(url);
    if (content.length < 80 || /^(?:challenge validation|enable javascript and cookies|request rejected)/i.test(content)) {
      throw new Error('No readable source text');
    }
    return { checkedAt: new Date().toISOString(), status: 'reachable' };
  } catch (error) {
    return { checkedAt: new Date().toISOString(), status: 'unavailable', reason: error.message };
  }
}

async function main() {
  const dossier = require('../public/data/research.json');
  const urls = [...new Set(sources(dossier).flatMap(({ url, alternates }) =>
    [url, ...(alternates || []).map((item) => item.url)]))].sort();
  const retry = process.argv.includes('--retry');
  const records = retry ? JSON.parse(await fs.readFile(reportFile, 'utf8')) : {};
  const remaining = urls.filter((url) => records[url]?.status !== 'reachable');
  let next = 0;
  let finished = 0;
  await Promise.all(Array.from({ length: 32 }, async () => {
    while (next < remaining.length) {
      const url = remaining[next++];
      records[url] = await check(url);
      finished++;
      if (finished % 64 === 0) console.log('Checked ' + finished + ' of ' + remaining.length);
    }
  }));
  const ordered = Object.fromEntries(urls.map((url) => [url, records[url]]));
  await fs.writeFile(reportFile, JSON.stringify(ordered, null, 2) + '\n');
  const unavailable = urls.filter((url) => records[url].status === 'unavailable');
  console.log(urls.length + ' public source URLs checked; ' + unavailable.length + ' unavailable.');
  for (const url of unavailable) console.log(url + ' | ' + records[url].reason);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { sources };
