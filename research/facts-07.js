const onetrust = 'https://www.onetrust.com/content/dam/onetrust/brand/content/asset/certifications/ot-security-privacy-and-architecture-white-paper-v7.pdf';
const adobe = 'https://www.adobe.com/content/dam/cc/en/pdfs/Adobe-Career-Academy_Privacy-Notice.pdf';
const akamai = 'https://www.akamai.com/site/en/documents/corporate/2024/akamai-services-data-flows-risks.pdf';
const tiktok = 'https://newsroom.tiktok.com/tiktok-facts-how-we-secure-personal-information-and-store-data?lang=en';
const make = (id, url, section, claim, ...terms) => ({
  id, url, section, claim, company: true, publisher: id, terms, creation: [id],
});

module.exports = [
  make('OneTrust', onetrust, 'destinations', {
    country: 'United States', note: 'OneTrust lists the US among hosting regions its customers can select.',
  }, 'OneTrust', 'select hosting locality', 'including the United States'),
  make('OneTrust', onetrust, 'sharesWith', {
    party: 'Microsoft Azure', purpose: 'Host the OneTrust cloud service',
  }, 'OneTrust cloud hosting is provided by Microsoft Azure'),
  make('Adobe', adobe, 'declared', {
    data: 'General location inferred from IP address', purpose: 'Create inferences in the context of the Adobe Career Academy program',
  }, 'Adobe', 'general geographic location', 'IP address'),
  make('Adobe', adobe, 'sharesWith', {
    party: 'Service providers', purpose: 'Support the Adobe Career Academy program',
  }, 'Adobe', 'Career Academy', 'service providers'),
  make('Akamai Technologies', akamai, 'declared', {
    data: 'IP addresses', purpose: 'Deliver services subject to the data flow guidance',
  }, 'Akamai', 'IP address', 'personal data'),
  make('Adobe', 'https://www.adobe.com/privacy/privacy-notice.html', 'declared', {
    data: 'Email address, purchase history and IP address', purpose: 'Run Adobe’s business',
  }, 'Adobe', 'data that may be used to run our business', 'purchase history', 'IP address'),
  make('Adobe', 'https://www.adobe.com/privacy/sub-processors.html', 'sharesWith', {
    party: 'Amazon Web Services', purpose: 'Host Adobe cloud applications',
  }, 'Amazon Web Services', 'provides cloud hosting services for Adobe'),
  make('ByteDance', tiktok, 'destinations', {
    country: 'United States', note: 'TikTok’s October 2023 storage disclosure listed US servers.',
  }, 'TikTok', 'October 12, 2023', 'servers located in the United States, Singapore, and Malaysia'),
  make('ByteDance', tiktok, 'sharesWith', {
    party: 'Oracle', purpose: 'Provide US cloud infrastructure for newly collected US TikTok user data, as disclosed in October 2023',
  }, 'TikTok', 'all new U.S. user data is stored automatically', 'Oracle'),
  make('ByteDance', 'https://newsroom.tiktok.com/mythbusting-the-facts-on-reports-about-our-data-collection-practices-ca?lang=en-CA', 'declared', {
    data: 'Approximate location in Canada when Location Services is enabled', purpose: 'Operate TikTok with optional location access',
  }, 'TikTok collects approximate location information', 'Location Services is actively enabled'),
  make('Comscore', 'https://www.comscore.com/About/Privacy-Policy', 'destinations', {
    country: 'United States', note: 'Comscore says website or program data may be processed in the United States, where it operates its central database.',
  }, 'Comscore', 'including the United States where our central database is operated'),
  make('Stripe', 'https://stripe.com/en-us/privacy', 'destinations', {
    country: 'United States', note: 'Stripe identifies the US as one of the countries where data may be transferred.',
  }, 'Stripe', 'other than your own, including the United States'),
  make('X Corp.', 'https://x.com/en/privacy', 'destinations', {
    country: 'United States', note: 'X uses a European-to-US conversation as an example of when information moves across borders.',
  }, 'X Corp.', 'having a conversation with someone in the United States', 'information has to move between those countries'),
];
