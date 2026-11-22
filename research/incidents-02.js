const dpc = 'Irish Data Protection Commission';
const meta = 'https://www.dataprotection.ie/en/news-media/press-releases/Data-Protection-Commission-announces-conclusion-of-inquiry-into-Meta-Ireland';
const facebook = ['Facebook','Meta','social','facebook.com'];
const metaClaim = { kind: 'fine', title: 'Meta EU–US transfer inquiry', year: 2023, jurisdiction: 'Ireland / EU', amount: '€1.2 billion',
  summary: 'The DPC announced a fine and corrective orders over Meta Ireland’s transfers of Facebook users’ personal data from the EU/EEA to the United States.' };
module.exports = [
  { id: 'facebook', creation: facebook, publisher: dpc, url: meta, date: '2023-05-22',
    terms: ['facebook','meta ireland','€1.2 billion','transfer personal data','usa'], section: 'incidents', claim: metaClaim },
  { id: 'Meta', company: true, creation: ['Meta'], publisher: dpc, url: meta, date: '2023-05-22',
    terms: ['facebook','meta ireland','€1.2 billion','transfer personal data','usa'], section: 'incidents', claim: metaClaim },
  { id: 'whatsapp', creation: ['WhatsApp','WhatsApp','communication','whatsapp.com'], publisher: dpc,
    url: 'https://www.dataprotection.ie/en/dpc-guidance/decisions/decision-concerning-whatsapp-ireland-ltd',
    terms: ['whatsapp','€225 million','transparency','2021'], section: 'incidents',
    claim: { kind: 'fine', title: 'WhatsApp transparency inquiry', year: 2021, jurisdiction: 'Ireland / EU', amount: '€225 million',
      summary: 'The DPC imposed a fine and ordered corrective measures after examining the information provided about processing to users and non-users.' } },
  { id: 'epic-games', creation: ['Epic Games','Epic Games','games','epicgames.com'], publisher: 'U.S. Department of Justice',
    url: 'https://www.justice.gov/archives/opa/pr/epic-games-inc-developer-fortnite-video-game-agrees-275-million-penalty-and-injunction',
    date: '2022-12-19', terms: ['epic games','fortnite','$275 million','children','2022'], section: 'incidents',
    claim: { kind: 'settlement', title: 'Fortnite children’s privacy settlement', year: 2022, jurisdiction: 'United States', amount: 'USD 275 million',
      summary: 'Epic agreed to a civil penalty and injunction to resolve allegations involving collection of children’s data in Fortnite.' } },
  { id: 'avast', creation: ['Avast','Gen Digital','security','avast.com'], publisher: 'Federal Trade Commission',
    url: 'https://search.ftc.gov/legal-library/browse/cases-proceedings/2023033-avast',
    terms: ['avast','$16.5 million','browsing data','2024'], section: 'incidents',
    claim: { kind: 'settlement', title: 'Avast browsing data order', year: 2024, jurisdiction: 'United States', amount: 'USD 16.5 million',
      summary: 'The FTC required a payment and restricted use of browsing data after alleging that Avast and its subsidiaries sold such data despite privacy promises.' } },
];
