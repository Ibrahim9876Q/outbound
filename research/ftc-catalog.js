// Independently fetch the FTC index and each candidate case. Only claim topics supported
// in the case summary, and distinguish docket listings from findings or settlements.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { buildIndex } = require('./index');

const run = promisify(execFile);
const base = 'https://search.ftc.gov';
const file = path.join(__dirname, '..', 'public/data/research.json');
const publisher = 'Federal Trade Commission';
const topics = [
  [/coppa|children.{0,22}(?:personal information|privacy|online privacy)/i, 'children’s online privacy'],
  [/privacy shield|safe harbor framework|safe harbour framework|data privacy framework/i, 'privacy framework representations'],
  [/data breach|security breach|breach exposed/i, 'a data breach and related security practices'],
  [/biometric|facial recognition/i, 'biometric data or facial recognition'],
  [/precise location|sensitive location|geolocation|location data/i, 'location information'],
  [/health data|health information|medical records/i, 'health information'],
  [/browsing data|browsing history|viewing histor/i, 'browsing or viewing information'],
  [/credit report|consumer report|fair credit reporting act/i, 'consumer reports and related privacy obligations'],
  [/targeted advertising|behavioral advertising|advertising purposes/i, 'use of information for advertising'],
  [/personal information|personal data|sensitive information|consumer information/i, 'handling of personal information'],
  [/privacy practices|privacy policy|privacy promises/i, 'representations about privacy practices'],
  [/data security|information security|security practices/i, 'security practices for information'],
];

const aliases = [
  [/byte.?dance|musical\.ly/i, 'tiktok'], [/facebook/i, 'facebook'], [/amazon.*alexa/i, 'amazon-alexa'],
  [/twitter/i, 'x'], [/snapchat|^snap,/i, 'snapchat'], [/uber/i, 'uber'],
  [/microsoft corporation/i, 'xbox'], [/zoom video/i, 'zoom'], [/oracle corporation/i, 'Oracle', true],
  [/inmarket/i, 'InMarket', true], [/gravy analytics/i, 'Gravy Analytics', true], [/mobilewalla/i, 'Mobilewalla', true],
  [/ring, llc/i, 'Ring', true], [/bittorrent/i, 'BitTorrent', true], [/paypal/i, 'PayPal', true],
  [/^google/i, 'Google', true], [/^amazon/i, 'Amazon', true], [/^disney/i, 'Disney', true],
];
// These matters already have a separate curated entry or are reserved for the priority batch.
const known = /avast|kochava|epic games|betterhelp|goodrx|flo health|x-mode|zoom video|uber technologies|google llc and youtube|twitter, inc\., u\.s\.|facebook, inc\.|bytedance, ltd\.|musical\.ly|snapchat, inc\.|ring, llc|microsoft corporation/i;

function plain(html) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&nbsp;|&#160;/g, ' ').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

async function get(url) {
  const { stdout } = await run('curl.exe', ['-fsSL', '--proto', '=https', '--proto-redir', '=https', '--max-time', '16',
    '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', url],
  { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

function parseIndex(html) {
  return [...html.matchAll(/<li><span class="field-content"><a href="(\/legal-library\/browse\/cases-proceedings\/[^"]+)"[^>]*>([^<]+)<\/a><\/span> \(<time datetime="([\d-]{10})/g)]
    .map(([, href, title, updated]) => ({ url: base + href, title: plain(title), updated }));
}

function targetFor(title, dossier) {
  for (const [pattern, id, company] of aliases) {
    if (!pattern.test(title)) continue;
    if (!company) return dossier.apps.find((app) => app.id === id);
    return dossier.companies.find((entry) => entry.name === id) || makeCompany(id, dossier);
  }
  const name = title.replace(/^FTC v\.?\s+/i, '').replace(/,?\s+(?:in the matter of|u\.s\. v\.|ftc v\.)\s*$/i, '').trim();
  // Require a named organization or brand, avoiding captions whose primary party is a person or unclear.
  if (!name || name.length > 100 || /^(united states|ftc|state of)|\bplaintiff\b|\bet al\.|\band\b/i.test(name)) return null;
  const app = dossier.apps.find((item) => item.name.toLowerCase() === name.toLowerCase());
  return app || dossier.companies.find((item) => item.name.toLowerCase() === name.toLowerCase()) || makeCompany(name, dossier);
}

function makeCompany(name, dossier) {
  const company = { name, aliases: [], hq: { city: null, country: null }, incidents: [], declared: [] };
  dossier.companies.push(company);
  return company;
}

async function inspect(candidate) {
  const { url, title } = candidate;
  const html = await get(url);
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] || html;
  const heading = plain(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '');
  const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!heading || !normalize(heading).includes(normalize(title))) throw new Error('case title mismatch');
  const block = /Case Summary\s*<\/h2>([\s\S]*?)(?=<h2\b|<\/main>)/i.exec(main)?.[1];
  const summary = plain(block || '');
  const timeline = /Case Timeline\s*<\/h2>([\s\S]*)/i.exec(main)?.[1];
  const headlines = [...(timeline || '').matchAll(/<a href="\/news-events\/news\/press-releases\/[^"]+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, text]) => plain(text)).join(' ');
  const summaryTopic = summary.length >= 60 && topics.find(([pattern]) => pattern.test(summary))?.[1];
  const topic = summaryTopic || topics.find(([pattern]) => pattern.test(headlines))?.[1];
  if (!topic) throw new Error('privacy topic not supported by the case summary or release headlines');
  const dates = [...(timeline || '').matchAll(/\bdatetime="([\d-]{10})T/g)].map(([, date]) => date).sort();
  if (!dates.length) throw new Error('no dated case timeline');
  const year = Number(dates[0].slice(0, 4));
  const fileNumber = /FTC Matter\/File Number[\s\S]{0,250}?class="field__item"[^>]*>\s*([^<]+)/i.exec(main)?.[1]?.trim();
  return {
    kind: /\b(?:U\.S\.|FTC|USA) v\./i.test(title) ? 'court' : 'regulator',
    title: title + ' · FTC case record',
    year,
    jurisdiction: 'United States',
    summary: (summaryTopic ? 'The FTC case summary' : 'A press release linked in the FTC case timeline') +
      ' describes a matter involving ' + topic + '. ' +
      'The earliest dated item in the published case timeline is from ' + year + '.',
    ...(fileNumber ? { caseRef: fileNumber } : {}),
    source: { title: heading, publisher, url, date: candidate.updated, verified: true, fetchedAt: new Date().toISOString() },
  };
}

async function main() {
  const offset = Number(process.argv[2] || 0);
  const pages = Number(process.argv[3] || 3);
  const limit = Number(process.argv[4] || 20);
  const dossier = JSON.parse(await fs.readFile(file, 'utf8'));
  const existing = [...dossier.apps, ...dossier.companies].flatMap((item) => item.incidents);
  const existingUrls = new Set(existing.map(({ source }) => new URL(source.url).pathname));
  const existingRefs = new Set(existing.map((item) => item.caseRef).filter(Boolean));
  const rejectFile = path.join(__dirname, 'rejected.md');
  const history = await fs.readFile(rejectFile, 'utf8');
  const tried = new Set(history.split('\n').filter((line) => !/no substantive case summary|privacy topic not supported by the case summary\s*$/.test(line))
    .flatMap((line) => [...line.matchAll(/https:\/\/search\.ftc\.gov\/legal-library\/browse\/cases-proceedings\/[^\s]+/g)])
    .map(([url]) => new URL(url).pathname));
  const index = await Promise.allSettled(Array.from({ length: pages }, (_, i) =>
    get(base + '/enforcement/cases-proceedings/terms/1420?page=' + (offset + i)).then(parseIndex)));
  const leads = [...new Map(index.flatMap((item) => item.status === 'fulfilled' ? item.value : [])
    .map((item) => [item.url, item])).values()].filter((item) => {
      const pathname = new URL(item.url).pathname;
      return !known.test(item.title) && !existingUrls.has(pathname) && !tried.has(pathname);
    });
  let count = 0;
  const rejects = index.flatMap((result, i) => result.status === 'rejected' ? ['- FTC index page ' + (offset + i) + ' could not be fetched.'] : []);
  for (let i = 0; i < leads.length && count < limit; i += 12) {
    const group = leads.slice(i, i + 12);
    const results = await Promise.allSettled(group.map(inspect));
    for (let j = 0; j < results.length && count < limit; j++) {
      const result = results[j];
      const lead = group[j];
      if (result.status === 'rejected') {
        const reason = result.reason.stderr ? String(result.reason.stderr).trim().slice(0, 140) : result.reason.message;
        rejects.push('- ' + lead.title + ' — ' + lead.url + ' — ' + reason);
        continue;
      }
      const item = result.value;
      if (item.caseRef && existingRefs.has(item.caseRef)) continue;
      const target = targetFor(lead.title, dossier);
      if (!target) { rejects.push('- ' + lead.title + ' — ' + lead.url + ' — unclear dossier entity.'); continue; }
      target.incidents.push(item);
      if (item.caseRef) existingRefs.add(item.caseRef);
      count++;
      console.log(item.year + ' | ' + lead.title + ' | ' + target.name);
    }
  }
  if (rejects.length) await fs.appendFile(rejectFile,
    '\n## FTC privacy case index pages ' + offset + '–' + (offset + pages - 1) + '\n\n' + rejects.join('\n') + '\n');
  if (count) {
    dossier.generatedAt = new Date().toISOString();
    dossier.index = buildIndex(dossier.apps);
    await fs.writeFile(file, JSON.stringify(dossier, null, 2) + '\n');
  }
  console.log('Accepted ' + count + ' FTC case records from ' + leads.length + ' candidate URLs.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
