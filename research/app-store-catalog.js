const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const { buildIndex } = require('./index');

const run = promisify(execFile);
const base = 'https://apps.apple.com';
const file = path.join(__dirname, '../public/data/research.json');
const chosen = [
  [36, 'general', /^(Vinted|GoWish|PineDrama|Google Home|Netflix Game Controller|Quince|Whatnot)\b/i],
  [6002, 'utilities', /^(Govee Home|Google Authenticator|My Verizon|Apple Support|Proton VPN|Xfinity|Blink Home Monitor|Starlink|My Spectrum|Bambu Handy|NordVPN|1\.1\.1\.1)\b/i],
  [6015, 'finance', /^(Kalshi|Cash App|PayPal|Venmo|Klarna|Chime|Remitly|Fidelity Investments|Rocket Money|Robinhood|Intuit Credit Karma)\b/i],
  [6024, 'shopping', /^(Best Buy|Depop|Amazon Shopping|Costco|Affirm|Bath & Body Works)\b/i],
  [6007, 'productivity', /^(Gmail|Grok|Microsoft Authenticator|Google Drive|Meta AI|Google Docs|Google Sheets|Link to Windows|Yahoo Mail|Smart Home Manager|Google Slides|Google Calendar|HP)\b/i],
  [6006, 'reference', /^(Bible Chat|Bible Shorts|Translate Now|Collectr|Bible Path|FoilSnap|PSA|Hallow|WoodSense|Ancestry|CoinSnap|Sky Guide|COtrip Planner)\b/i],
  [6013, 'health', /^(Oura|AHEALTH|Planet Fitness|Sweatcoin|WeWard|Yuka|LADDER|Garmin Connect|MenuFit|Cal AI|AllTrails|Crunch Fitness|Hume Health|Aetna Health|RISE|MyFitnessPal|Finch|ClassPass|Hatch Sleep)\b/i],
  [6017, 'education', /^(Duolingo|Learna|Imprint|Toca Boca World|Deepstash|Google Classroom|Knowunity|ParentSquare|Gauth|Kahoot|Canvas by Instructure|ABCmouse|Simply Draw|PictureThis|Lingokids|Quizlet|ClassDojo|PowerSchool Mobile|Elevate)\b/i],
];

function plain(value) {
  return value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
}

async function get(url) {
  const { stdout } = await run('curl.exe', ['-fsSL', '--proto', '=https', '--proto-redir', '=https',
    '--max-time', '20', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', url],
  { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function verify(candidate) {
  const { name, category, id, url } = candidate;
  const html = await get(url);
  const title = plain(/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] || '');
  if (!title.includes(name)) throw new Error('App Store title does not match the chart entry');
  const privacy = html.match(/aria-label="Data Linked to You"([\s\S]*?)(?=aria-label="Data Not Linked to You"|<\/section>)/)?.[1];
  const categories = [...new Set([...((privacy || '').matchAll(/<span class="category-title[^"]*"[^>]*>([^<]+)<\/span>/g))]
    .map(([, field]) => plain(field)))];
  if (!categories.length) throw new Error('No developer-declared data linked to the user');
  const developer = /<dt[^>]*>\s*(?:Provider|Seller)\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i.exec(html)?.[1];
  if (!developer) throw new Error('No named app provider');
  const publisher = plain(developer);
  return {
    id, name, publisher, category, processNames: [], domains: [], hq: { city: null, country: null },
    declared: [{
      data: categories.join(', '),
      purpose: 'The developer declares these categories as data that may be linked to the user.',
      source: { title, publisher, url, date: null, verified: true, fetchedAt: new Date().toISOString() },
    }],
    sharesWith: [], destinations: [], incidents: [],
  };
}

async function main() {
  const dossier = JSON.parse(await fs.readFile(file, 'utf8'));
  const limit = Number(process.argv[2] || 20);
  const rejected = [];
  const candidates = new Map();
  for (const [genre, category, match] of chosen) {
    const url = base + '/us/iphone/charts/' + genre + '?chart=top-free';
    try {
      const html = await get(url);
      for (const [, label, href, id] of html.matchAll(/aria-label="([^"]+)" href="(https:\/\/apps\.apple\.com\/us\/app\/[^"]*?\/id(\d+))"/g)) {
        const name = plain(label).match(match)?.[0];
        if (name) candidates.set(id, { name, url: href, category, id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
      }
    } catch {
      rejected.push('- ' + url + ' — chart unavailable');
    }
  }
  const names = new Set(dossier.apps.map((app) => app.name.toLowerCase()));
  const ids = new Set(dossier.apps.map((app) => app.id));
  const leads = [...candidates.values()].filter((app) => !names.has(app.name.toLowerCase()) && !ids.has(app.id));
  let count = 0;
  for (let i = 0; i < leads.length && count < limit; i += 8) {
    const batch = leads.slice(i, i + 8);
    const results = await Promise.allSettled(batch.map(verify));
    for (let j = 0; j < results.length && count < limit; j++) {
      const result = results[j];
      if (result.status === 'rejected') {
        rejected.push('- ' + batch[j].name + ' — ' + batch[j].url + ' — ' + result.reason.message.split('\n')[0]);
      } else if (!ids.has(result.value.id)) {
        dossier.apps.push(result.value);
        ids.add(result.value.id);
        count++;
      }
    }
  }
  if (rejected.length) await fs.appendFile(path.join(__dirname, 'rejected.md'),
    '\n## App Store chart leads\n\n' + rejected.join('\n') + '\n');
  if (count) {
    dossier.generatedAt = new Date().toISOString();
    dossier.index = buildIndex(dossier.apps);
    await fs.writeFile(file, JSON.stringify(dossier, null, 2) + '\n');
  }
  console.log('Accepted ' + count + ' of ' + leads.length + ' eligible App Store chart leads.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
