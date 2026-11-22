const fs = require('node:fs/promises');
const path = require('node:path');
const { fetchSource } = require('./build');

const file = path.join(__dirname, '../public/data/research.json');
const selections = [
  ['Tim Hortons mobile location investigation', '2022-06-01', 'including when the App was not open'],
  ['Home Depot’s sharing of e-receipt data with Meta', '2023-01-26', 'Home Depot failed to ensure valid meaningful consent for its practice of sharing customer information with Meta'],
  ['Instagram children’s data inquiry', '2022-09-15', 'imposing a fine of €405 million and a range of corrective measures'],
  ['TikTok EEA data transfer inquiry', '2025-05-02', 'TikTok infringed the GDPR regarding its transfers of EEA User Data to China'],
  ['GoodRx health-data advertising action', '2023-02-01', 'failing to report its unauthorized disclosure of consumer health data to Facebook, Google, and other companies'],
  ['BetterHelp advertising disclosure order', '2023-07-14', 'requiring online counseling service BetterHelp to pay $7.8 million'],
  ['Kochava location data complaint', '2022-08-29', 'Kochava’s data can reveal people’s visits to reproductive health clinics, places of worship'],
  ['Mobilewalla final location-data order', '2025-01-14', 'finalized an order banning data broker Mobilewalla Inc. from selling sensitive location data'],
  ['Avast browsing data order', '2024-02-22', 'The FTC alleged Avast sold that data to more than 100 third parties through its subsidiary, Jumpshot',
    'https://search.ftc.gov/news-events/news/press-releases/2024/02/ftc-order-will-ban-avast-selling-browsing-data-advertising-purposes-require-it-pay-165-million-over'],
  ['ChatGPT conversation history exposure', '2023-03-24', 'allowed some users to see titles from another active user’s chat history'],
  ['Dutch authority fines Netflix over privacy information', '2024-12-18', 'Netflix has since updated its privacy statement and improved its information provision'],
  ['Clearview AI joint investigation', '2021-02-02', 'continual mass surveillance by Clearview based on its indiscriminate scraping and processing of their facial images'],
  ['Desjardins personal information breach', '2020-12-14', 'a breach of security safeguards that ultimately affected close to 9.7 million individuals in Canada and abroad'],
  ['Fortnite children’s privacy settlement', '2022-12-19', 'Epic will pay a $275 million penalty for violating children’s privacy law'],
  ['Facebook 2019 privacy order settlement', '2019-07-24', 'FTC Imposes $5 Billion Penalty and Sweeping New Privacy Restrictions on Facebook'],
  ['WhatsApp transparency inquiry', '2021-08-20', 'Following this reassessment, the DPC imposed a fine of €225 million on WhatsApp'],
  ['ICO children’s privacy penalty', '2026-02-24', 'Reddit has appealed its monetary penalty notice to the First-tier Tribunal'],
  ['GM and OnStar proposed location-data order', '2025-01-16', 'including consumer reporting agencies, without consumers’ consent'],
  ['Gravy Analytics and Venntel final order', '2025-01-14', 'including data about consumers’ visits to health-related locations and places of worship'],
  ['LinkedIn targeted advertising inquiry', '2024-10-24', 'administrative fines totalling €310 million'],
];

function displayedText(value) {
  const entities = { amp: '&', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', euro: '€', pound: '£', quot: '"', nbsp: ' ' };
  return value.replace(/&#x([a-f\d]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&([a-z]+);/g, (whole, name) => entities[name] || whole)
    .replace(/\s+/g, ' ').trim();
}

function hasDate(content, html, iso) {
  const date = new Date(iso + 'T00:00:00Z');
  const month = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(date);
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return html.includes(iso) || new RegExp('\\b(?:' + month + ' 0?' + day + ',? |0?' + day +
    '(?:st|nd|rd|th)? ' + month + ' )' + year + '\\b', 'i').test(content);
}

async function main() {
  const dossier = JSON.parse(await fs.readFile(file, 'utf8'));
  const incidents = new Map([...dossier.apps, ...dossier.companies].flatMap((item) => item.incidents)
    .map((item) => [item.title, item]));
  const results = await Promise.allSettled(selections.map(async ([title, date, quote, override]) => {
    const item = incidents.get(title);
    if (!item) throw new Error('Incident not found');
    const url = override || item.source.url;
    const { html, content } = await fetchSource(url);
    const displayed = displayedText(content);
    const pageTitle = displayedText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '');
    if (!pageTitle || !hasDate(displayed, html, date)) throw new Error('Page title or date could not be verified');
    if (quote.split(/\s+/).length > 25 || !displayed.includes(quote)) throw new Error('Exact quote did not match');
    return { item, quote, quoteSource: { url, title: pageTitle, publisher: item.source.publisher,
      date, verified: true, fetchedAt: new Date().toISOString() } };
  }));
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') console.error(selections[index][0] + ': ' + result.reason.message);
    else {
      const { item, quote, quoteSource } = result.value;
      Object.assign(item, { quote, quoteSource });
    }
  }
  const count = results.filter((item) => item.status === 'fulfilled').length;
  if (count !== selections.length) throw new Error('Verified ' + count + ' of ' + selections.length + ' exact quotes; no records written.');
  dossier.generatedAt = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(dossier, null, 2) + '\n');
  console.log('Verified ' + count + ' exact quotes with fetched page titles and dates.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
