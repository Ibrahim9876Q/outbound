const reddit = 'https://storage.googleapis.com/transparency_hub_documents/675211559efd527760c6441a/privacy_policy/1782892824.pdf';
const akamai = 'https://www.akamai.com/site/en/documents/corporate/akamai-privacy-statement.pdf';
const make = (id, url, section, claim, terms) => ({
  id, url, section, claim, company: true, publisher: id, terms, creation: [id],
});
const destination = (id, url, country, note, terms) =>
  make(id, url, 'destinations', { country, note }, terms);

module.exports = [
  make('Reddit', reddit, 'declared', { data: 'IP address and device information', purpose: 'Operate and protect Reddit' },
    ['Reddit Privacy Policy', 'IP address', 'device information']),
  make('Reddit', reddit, 'sharesWith', { party: 'Service providers', purpose: 'Perform services for Reddit' },
    ['Reddit Privacy Policy', 'transfer it to our affiliates, service providers']),
  destination('Reddit', reddit, 'United States', 'Reddit says it may store information on United States servers.',
    ['Reddit Privacy Policy', 'store information on servers located in the United States']),
  destination('Automattic', 'https://automattic.com/subprocessor-list/', 'United States', 'Automattic lists Amazon Web Services in the US for storage and backups.',
    ['Automattic', 'Amazon Web Services', 'Storage and backup of data United States']),
  destination('New Relic', 'https://newrelic.com/termsandconditions/privacy', 'United States',
    'New Relic describes applying the EU–U.S. Data Privacy Framework to covered transfers to the US.',
    ['New Relic', 'EU-U.S. Data Privacy Framework', 'personal data transferred']),
  destination('Criteo', 'https://www.criteo.com/wp-content/uploads/2024/05/The-Media-Grid-Sub-Processors.pdf', 'United States',
    'Criteo’s Media Grid disclosure identifies US subprocessors. This disclosure applies to Media Grid.',
    ['The Media Grid', 'sub-processors', 'United States']),
  make('Akamai Technologies', akamai, 'declared', { data: 'IP addresses', purpose: 'Provide services covered by the Akamai privacy statement' },
    ['Akamai', 'IP address', 'personal data']),
  make('Akamai Technologies', akamai, 'sharesWith', { party: 'Service providers', purpose: 'Provide contracted services to Akamai' },
    ['Akamai', 'service providers', 'share']),
  destination('Akamai Technologies', akamai, 'United States', 'The statement describes processing in the United States.',
    ['Akamai', 'processed in the United States']),
  destination('Comscore', 'https://www.comscore.com/About/Privacy-Policy', 'United States',
    'Comscore identifies the US as the location of its central database.',
    ['Comscore', 'including the United States where our central database is operated']),
];
