function fact(id, publisher, url, section, claim, terms, app = false) {
  return { id, publisher, url, section, claim, terms, company: !app,
    creation: app ? undefined : [id] };
}
const share = (id, publisher, url, party, purpose, terms, app) =>
  fact(id, publisher, url, 'sharesWith', { party, purpose }, terms, app);
const destination = (id, publisher, url, country, note, terms, app) =>
  fact(id, publisher, url, 'destinations', { country, note }, terms, app);

const chrome = 'https://policies.google.com/privacy?hl=en-US';
const google = 'https://policies.google.com/privacy/frameworks?hl=en';
const meta = 'https://about.fb.com/news/2019/08/off-facebook-activity/';
const metaPartners = 'https://about.fb.com/news/2018/12/facebooks-partners/amp/';
const metaTransfer = 'https://about.fb.com/news/2023/05/our-response-to-the-decision-on-facebooks-eu-us-data-transfers/';
const microsoft = 'https://privacy.microsoft.com/en-us/privacystatement';
const spotify = 'https://www.spotify.com/kr-en/legal/korea-entrustmentandtransfers/';
const kaspersky = 'https://www.kaspersky.com/transparency-center';
const subprocessor = 'https://privacy.claude.com/en/articles/7996890-where-are-your-servers-located-do-you-host-your-models-on-eu-servers';

module.exports = [
  destination('Google', 'Google', google, 'United States',
    'Google says it relies on the EU–U.S. Data Privacy Framework for covered transfers.',
    ['Google', 'EU-U.S. and Swiss-U.S. Data Privacy Frameworks', 'personal information']),
  destination('Amazon', 'Amazon Web Services', 'https://aws.amazon.com/privacy/', 'United States',
    'The AWS notice says personal information associated with AWS offerings may be stored in or accessed from the United States.',
    ['Amazon Web Services', 'stored in or accessed from multiple countries, including the United States']),
  destination('Cloudflare', 'Cloudflare', 'https://www.cloudflare.com/privacypolicy/', 'United States',
    'Cloudflare names the US as one of its main storage locations.',
    ['Cloudflare', 'primarily store your information in the United States']),
  fact('Meta', 'Meta', meta, 'declared', { data: 'Activity information from third-party apps and sites',
    purpose: 'Personalize ads on Meta services when permitted by the account settings' },
    ['Facebook', 'send us information about your activity', 'target ads']),
  share('Meta', 'Meta', metaPartners, 'Integration partners',
    'Meta describes historical integrations authorized by users, including some that accessed messages.',
    ['Facebook', 'integration partners', 'our API provided partners with access']),
  destination('Meta', 'Meta', metaTransfer, 'United States',
    'Meta describes transfers of European Facebook data to the United States.',
    ['Facebook', 'EU-US Data Transfers', 'European Commission adequacy decision']),
  destination('Datadog', 'Datadog', 'https://www.datadoghq.com/legal/privacy/', 'United States',
    'Datadog names the US among countries where personal information may be processed.',
    ['Datadog', 'accessed from, or stored in a country', 'including the United States']),
  fact('Kaspersky Lab', 'Kaspersky', kaspersky, 'declared', { data: 'Voluntarily shared suspicious files',
    purpose: 'Analyze potential malware' }, ['Kaspersky', 'malicious and suspicious files voluntarily shared', 'malware analysis']),
  destination('Kaspersky Lab', 'Kaspersky', kaspersky, 'Switzerland',
    'Kaspersky says some customer threat data is processed in Zurich.',
    ['Kaspersky', 'processed in two data centers in Zurich', 'Switzerland']),
  share('chrome', 'Google', chrome, 'Service providers',
    'The Google privacy policy covering Chrome describes use of service providers to run its products.',
    ['Google', 'Chrome', 'service providers to help operate our data centers'], true),
  destination('chrome', 'Google', google, 'United States',
    'Google’s service-wide transfer notice describes reliance on the EU–U.S. privacy framework.',
    ['Google', 'EU-U.S. and Swiss-U.S. Data Privacy Frameworks', 'personal information'], true),
  share('edge', 'Microsoft', microsoft, 'Service providers',
    'Microsoft’s policy covering Edge describes service providers acting on its behalf.',
    ['Microsoft Edge', 'service providers acting on our behalf'], true),
  share('teams', 'Microsoft', microsoft, 'Service providers',
    'Microsoft’s policy covering Teams describes service providers acting on its behalf.',
    ['Microsoft Teams', 'service providers acting on our behalf'], true),
  destination('teams', 'Microsoft', microsoft, 'United States',
    'Microsoft’s general policy covering Teams names the US as a possible processing location.',
    ['Microsoft Teams', 'stored and processed in your region, in the United States'], true),
  destination('spotify', 'Spotify', spotify, 'United States',
    'Spotify’s Korea notice names this destination for several third-party services.',
    ['Spotify', 'overseas transfers', 'United States of America', 'customer support'], true),
  destination('claude', 'Anthropic', subprocessor, 'United States',
    'Anthropic says it may route customer traffic to the United States unless otherwise agreed.',
    ['Anthropic', 'route customer traffic to select countries in the US'], true),
  share('claude', 'Anthropic', subprocessor, 'Cloud service providers',
    'Process customer data', ['Anthropic', 'cloud service providers to process customer data'], true),
  destination('Stripe', 'Stripe', 'https://stripe.com/en-us/privacy', 'United States',
    'Stripe says it may transfer personal data to US data centers.',
    ['Stripe', 'transfer your Personal Data to data centers in the United States']),
  destination('Twilio', 'Twilio', 'https://www.twilio.com/en-us/legal/privacy', 'United States',
    'Twilio’s website notice describes covered transfers under the EU–U.S. Data Privacy Framework.',
    ['Twilio', 'EU-U.S. Data Privacy Framework', 'personal data']),
  share('Kaspersky Lab', 'Kaspersky', 'https://www.kaspersky.com/global-privacy-policy', 'Service providers',
    'Process information on behalf of Kaspersky', ['Kaspersky Lab', 'Service Providers. We also may share your information']),
];
