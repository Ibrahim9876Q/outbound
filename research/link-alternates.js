const fs = require('node:fs/promises');
const path = require('node:path');
const { fetchSource } = require('./build');
const { sources } = require('./link-health');

const file = path.join(__dirname, '../public/data/research.json');
const alternatives = [
  {
    original: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ',
    url: 'https://digprjsurvey.amazon.com/csad/help/node/GX7NJQ4ZB8MHFRNJ',
    terms: ['Amazon.com Privacy Notice', 'purchase history', 'download, stream, view, or use content', 'such as Prime Video'],
  },
  {
    original: 'https://autoriteitpersoonsgegevens.nl/en/current/dutch-dpa-imposes-a-fine-of-290-million-euro-on-uber-because-of-transfers-of-drivers-data-to-the-us',
    url: 'https://autoriteitpersoonsgegevens.nl/actueel/ap-legt-uber-boete-op-van-290-miljoen-euro-om-doorgifte-data-chauffeurs-naar-vs',
    terms: ['Uber', '290 miljoen euro', 'chauffeurs', 'Verenigde Staten', '2024'],
  },
];

async function main() {
  const dossier = JSON.parse(await fs.readFile(file, 'utf8'));
  const results = await Promise.allSettled(alternatives.map(async ({ original, url, terms }) => {
    const { content, html } = await fetchSource(url);
    const text = content.toLowerCase();
    const missing = terms.filter((term) => !text.includes(term.toLowerCase()));
    const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim();
    if (!title || missing.length) throw new Error(url + ' missing evidence: ' + missing.join(', '));
    const alternate = { url, title, verified: true, fetchedAt: new Date().toISOString() };
    let count = 0;
    for (const source of sources(dossier).filter((source) => source.url === original)) {
      source.alternates = [...(source.alternates || []).filter((item) => item.url !== url), alternate];
      count++;
    }
    return count;
  }));
  const count = results.reduce((total, item) => total + (item.status === 'fulfilled' ? item.value : 0), 0);
  for (const result of results) if (result.status === 'rejected') console.error(result.reason.message);
  if (count) {
    dossier.generatedAt = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify(dossier, null, 2) + '\n');
  }
  console.log(count + ' citations gained a verified alternate.');
  if (results.some((item) => item.status === 'rejected')) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
