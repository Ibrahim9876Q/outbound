const newRelic = 'https://docs.newrelic.com/docs/accounts/accounts-billing/account-setup/choose-your-data-center/';
const qualtrics = 'https://www.qualtrics.com/subprocessor-list/';
const akamai = 'https://www.linode.com/content/dam/site/en/documents/corporate/akamai-data-protection-addendum.pdf';
const make = (id, url, section, claim, terms) => ({
  id, url, section, claim, company: true, publisher: id, terms, creation: [id],
});
const destination = (id, url, country, note, terms) => make(id, url, 'destinations', { country, note }, terms);
module.exports = [
  destination('New Relic', newRelic, 'United States', 'New Relic lists the US as its default hosting region.',
    ['New Relic', 'the United States (US) region', 'The US region is the default']),
  destination('New Relic', newRelic, 'Japan', 'New Relic offers Japan as a hosting region for eligible organizations.',
    ['New Relic', 'Japan (JP) region', 'Japan data center']),
  destination('Qualtrics', qualtrics, 'United States', 'The subprocessor list identifies US-based Qualtrics entities that process data for cloud and support services.',
    ['Qualtrics, LLC, USA', 'involved in the processing of personal data']),
  destination('Magnite', 'https://www.magnite.com/legal/data-protection-framework/', 'United States',
    'Magnite’s framework notice describes transfers of personal information from the EU, UK and Switzerland to the US.',
    ['Magnite', 'transfers of personal information', 'to the United States']),
  make('Adobe', 'https://chromewebstore.google.com/detail/adobe-acrobat-pdf-edit-co/efaidnbmnnnibpcajpcglclefindmkaj', 'declared',
    { data: 'Location and user activity', purpose: 'Adobe’s Chrome Web Store disclosure for its Acrobat extension' },
    ['Adobe Acrobat', 'handles the following:', 'Location', 'User activity']),
  make('Akamai Technologies', akamai, 'declared',
    { data: 'IP addresses and geographic location derived from them', purpose: 'Data categories described in Akamai’s data protection addendum for covered services' },
    ['Akamai', 'Geographic location based upon IP address and location of Akamai server']),
  make('Akamai Technologies', akamai, 'sharesWith',
    { party: 'Authorized subprocessors', purpose: 'Support delivery of services under the Akamai data protection addendum' },
    ['Akamai', 'subprocessors', 'personal data']),
  make('jsDelivr', 'https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/Sub-Processors.md', 'sharesWith',
    { party: 'Cloudflare and other CDN providers', purpose: 'Serve jsDelivr requests and use request metadata for analytics and security' },
    ['jsDelivr CDN traffic', 'access to your IP address', 'analytics and security purposes', 'Cloudflare']),
  make('Criteo', 'https://www.criteo.com/wp-content/uploads/2024/05/The-Media-Grid-Sub-Processors.pdf', 'sharesWith',
    { party: 'Amazon Web Services and Google Cloud Platform', purpose: 'Provide data storage and associated services for The Media Grid' },
    ['The Media Grid', 'Amazon Web Services', 'Google Cloud Platform', 'Data storage and associated services']),
];
