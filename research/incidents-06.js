const ftc = 'Federal Trade Commission';
const cnil = 'CNIL';
const us = 'United States';
const caseRow = (id, publisher, url, year, kind, title, jurisdiction, summary, terms, options = {}) => ({
  id, publisher, url, section:'incidents', company:options.company, creation:options.creation,
  terms:[...terms,...(options.amountTerm ? [options.amountTerm] : [])],
  claim:{year,kind,title,jurisdiction,summary,...(options.amount ? {amount:options.amount} : {})},
});
module.exports = [
  caseRow('discord',cnil,'https://www.cnil.fr/sites/cnil/files/2023-05/cnil_-_43e_rapport_annuel_-_2022.pdf',2022,'fine','CNIL Discord sanction','France',
    'The CNIL reported a sanction against Discord in its 2022 activity report.',['discord inc','800 000 euros','2022'],
    {amount:'€800,000',amountTerm:'800 000 euros'}),
  caseRow('Criteo',cnil,'https://www.cnil.fr/sites/cnil/files/2024-04/cnil_44e_rapport_annuel_2023.pdf',2023,'fine','CNIL Criteo retargeting action','France',
    'The CNIL reported a fine after finding GDPR shortcomings involving proof of consent, access rights, and other practices in Criteo’s ad retargeting business.',['contre criteo','40 millions','consentement','2023'],
    {company:true,amount:'€40 million',amountTerm:'40 millions'}),
  caseRow('Google','U.S. Court of Appeals for the Ninth Circuit','https://cdn.ca9.uscourts.gov/datastore/opinions/2026/04/20/24-5692.pdf',2024,'settlement','Google private browsing class settlement','United States',
    'In its later appellate opinion, the court described a 2024 agreement resolving the certified class’s request for injunctive relief, with changes to disclosures and certain retained data.',['google','brown v. salcido','april 1, 2024','injunctive relief claim'],
    {company:true}),
  caseRow('Amazon',ftc,'https://search.ftc.gov/system/files/ftc_gov/pdf/1923128amazonalexaorderfiled.pdf',2023,'settlement','Alexa children’s records retention case',us,
    'The stipulated order imposed a civil penalty and obligations governing children’s Alexa data.',['amazon.com','alexa','1923128','2023'],
    {company:true,amount:'USD 25 million',amountTerm:'$25,000,000'}),
  caseRow('Ring',ftc,'https://search.ftc.gov/news-events/news/press-releases/2023/05/ftc-says-ring-employees-illegally-surveilled-customers-failed-stop-hackers-taking-control-users',2023,'settlement','Ring camera privacy and security case',us,
    'The FTC announced a proposed order addressing allegations of access to private camera footage and inadequate account protections.',['ring','cameras','videos','2023'],
    {company:true,creation:['Ring'],amount:'USD 5.8 million',amountTerm:'$5.8 million'}),
  caseRow('x',ftc,'https://search.ftc.gov/policy/advocacy-research/tech-at-ftc/2022/05/ftcs-twitter-case-enhancing-security-without-compromising-privacy',2022,'settlement','Twitter account security identifiers case',us,
    'The FTC described a penalty and settlement after alleging Twitter used security contact details for targeted advertising.',['twitter','advertising','security','2022'],
    {amount:'USD 150 million',amountTerm:'$150 million'}),
  caseRow('doordash','California Department of Justice','https://oag.ca.gov/system/files/media/doordash-final-judgment-signed.pdf',2024,'court','California DoorDash privacy judgment',us,
    'The judgment addresses California privacy claims and imposes monetary and compliance obligations on DoorDash.',['doordash','final judgment','2024','privacy']),
  caseRow('Sephora','California Department of Justice','https://oag.ca.gov/system/files/media/pea-sephora-filed-judgment.pdf',2022,'court','California Sephora privacy judgment',us,
    'The filed judgment imposes financial and compliance obligations in California’s action against Sephora under its consumer privacy law.',['sephora','final judgment','2022','consumer privacy'],
    {company:true,creation:['Sephora']}),
  caseRow('lyft','California Department of Justice','https://oag.ca.gov/news/press-releases/privacy-rights-can%E2%80%99t-be-left-rearview-attorney-general-bonta-secures-18-million',2026,'settlement','California Lyft privacy settlement',us,
    'The California Attorney General announced a privacy settlement with Lyft.',['lyft','settlement','2026'],
    {amount:'USD 1.8 million',amountTerm:'$1.8 million'}),
];
