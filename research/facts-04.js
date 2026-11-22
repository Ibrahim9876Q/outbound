const transfer = (id, publisher, country, url, note, terms, company = true) => ({
  id, company, publisher, url, section: 'destinations', terms, claim: { country, note },
});
const tiktokPolicy = 'https://newsroom.tiktok.com/tiktok-facts-how-we-secure-personal-information-and-store-data?lang=en';
const tiktok = (country) => transfer('tiktok', 'TikTok', country, tiktokPolicy,
  'TikTok named ' + country + ' as a server location in its October 2023 data storage disclosure.',
  ['TikTok', 'October 12, 2023', 'servers located in the United States, Singapore, and Malaysia'], false);

module.exports = [
  tiktok('United States'),
  tiktok('Malaysia'),
  tiktok('Singapore'),
  transfer('facebook', 'Meta', 'United States',
    'https://about.fb.com/news/2023/05/our-response-to-the-decision-on-facebooks-eu-us-data-transfers/',
    'Meta describes transferring European Facebook data to the United States.',
    ['Facebook', 'EU-US Data Transfers', 'European Commission adequacy decision'], false),
  transfer('Google', 'Google', 'United States', 'https://policies.google.com/privacy/frameworks?hl=en',
    'Google describes the frameworks it uses for transfers of personal information to the United States.',
    ['Google', 'United States', 'Data Privacy Framework']),
  transfer('Microsoft', 'Microsoft', 'United States', 'https://www.microsoft.com/en-us/privacy/privacystatement',
    'Microsoft lists the United States among the locations where it may process personal data.',
    ['Microsoft', 'Where we store and process personal data', 'United States']),
  transfer('Amazon', 'Amazon', 'United States', 'https://www.amazon.co.uk/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ',
    'Amazon’s UK notice names the United States in its international privacy framework disclosure.',
    ['Amazon', 'United States', 'Data Privacy Framework']),
];
