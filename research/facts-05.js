const targets = [
  ['Google', 'https://policies.google.com/privacy?hl=en-US', 'IP address', 'Deliver online services', 'service providers to help operate our data centers'],
  ['Amazon', 'https://digprjsurvey.amazon.com/csad/help/node/GX7NJQ4ZB8MHFRNJ', 'purchase history', 'Provide shopping services', 'third-party service providers have access to personal information'],
  ['Sentry', 'https://sentry.io/privacy/', 'email address', 'Register an account', 'third-party service providers', 'hosted in the United States and Germany'],
  ['Microsoft', 'https://privacy.microsoft.com/en-us/privacystatement', 'device identifiers', 'Operate and configure products', 'service providers acting on our behalf', 'stored and processed in your region, in the United States'],
  ['Cloudflare', 'https://www.cloudflare.com/privacypolicy/', 'email address', 'Communicate with site visitors', 'our service providers', 'transfer your Personal Information to the United States'],
  ['Meta', 'https://www.facebook.com/privacy/policy/', 'device information', 'Provide Meta products', 'service providers'],
  ['OneTrust', 'https://www.onetrust.com/privacy/', 'IP address', 'Record website visits', 'CRM service providers'],
  ['Adobe', 'https://www.adobe.com/legal/privacy.html', 'IP address', 'Operate Adobe services', 'service providers'],
  ['jsDelivr', 'https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/Privacy%20Policy.md', 'IP address', 'Operate the CDN', 'service providers'],
  ['Kaspersky Lab', 'https://www.kaspersky.com/global-privacy-policy', 'IP address', 'Operate services covered by its policy', 'service providers'],
  ['Stripe', 'https://stripe.com/en-us/privacy', 'transaction data', 'Process payments', 'share your Transaction Data with your bank'],
  ['Akamai Technologies', 'https://www.akamai.com/legal/privacy-statement', 'IP address', 'Operate services covered by its policy', 'service providers'],
  ['Datadog', 'https://www.datadoghq.com/legal/privacy/', 'IP address', 'Operate services covered by its policy', 'service providers', 'transferred to the United States'],
  ['Comscore', 'https://www.comscore.com/About/Privacy-Policy', 'IP address', 'Measure online audiences', 'service providers'],
  ['Criteo', 'https://www.criteo.com/privacy/', 'IP address', 'Provide advertising services', 'service providers'],
  ['Optimizely', 'https://www.optimizely.com/legal/privacy-policy/', 'IP address', 'Measure use of the site or services', 'service providers', 'personal information transferred to the U.S.'],
  ['Reddit', 'https://www.reddit.com/policies/privacy-policy', 'IP address', 'Log access to the service', 'service providers', 'transferred to the United States'],
  ['Twilio', 'https://www.twilio.com/en-us/legal/privacy', 'IP address', 'Operate communication services', 'service providers', 'transfer your personal data to the United States'],
  ['Automattic', 'https://automattic.com/privacy/', 'email address', 'Set up a WordPress.com account', 'third-party vendors'],
  ['GitHub', 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', 'IP address', 'Operate GitHub services', 'service providers', 'including your local region, the United States'],
  ['Magnite', 'https://www.magnite.com/legal/advertising-platform-privacy-policy/', 'IP address', 'Operate the advertising platform', 'service providers'],
  ['New Relic', 'https://newrelic.com/sites/default/files/2024-10/October%202024%20-New%20Relic%20General%20Data%20Privacy%20Notice.pdf', 'IP address', 'Operate services covered by its policy', 'service providers', 'transferred to the United States'],
  ['Qualtrics', 'https://www.qualtrics.com/privacy-statement/', 'IP address', 'Operate services covered by its statement', 'service providers'],
  ['X Corp.', 'https://x.com/en/privacy', 'IP address', 'Operate X services', 'service providers'],
  ['Amplitude', 'https://amplitude.com/privacy', 'IP address', 'Operate services covered by its notice', 'service providers', 'your Personal Data may be transferred to the United States'],
  ['Blockthrough', 'https://blockthrough.com/privacy-policy/', 'IP address', 'Operate services covered by its policy', 'service providers'],
  ['claude', 'https://www.anthropic.com/legal/privacy', 'inputs', 'Provide Claude', 'service providers', 'United States and other jurisdictions', 'Anthropic'],
  ['discord', 'https://discord.com/privacy', 'IP address', 'Operate Discord', 'service providers', null, 'Discord'],
  ['chrome', 'https://www.google.com/chrome/privacy/', 'IP address', 'Provide Chrome features covered by the Chrome notice', null, null, 'Google'],
  ['edge', 'https://privacy.microsoft.com/en-us/privacystatement', 'diagnostic data', 'Diagnose issues with Microsoft Edge', null, 'stored and processed in your region, in the United States', 'Microsoft'],
  ['teams', 'https://learn.microsoft.com/en-us/microsoftteams/teams-privacy', 'diagnostic data', 'Support and improve Microsoft Teams', null, null, 'Microsoft'],
  ['spotify', 'https://www.spotify.com/us/legal/privacy-policy/', 'streaming history', 'Provide playlists and recommendations', 'we hire to: give customer support', null, 'Spotify'],
];

module.exports = targets.flatMap(([id, url, data, purpose, sharing, transfer, appPublisher]) => {
  const publisher = appPublisher || id;
  const company = !appPublisher;
  const entity = { 'Akamai Technologies': 'Akamai', 'Kaspersky Lab': 'Kaspersky' }[id] || publisher;
  const claim = (section, fields, terms) => ({
    id, company, publisher, url, section, claim: fields, terms: [entity, ...terms],
    creation: company ? [id] : undefined,
    aliases: { Comscore: ['comScore, Inc.'], GitHub: ['GitHub, Inc.'] }[id],
  });
  return [
    claim('declared', { data, purpose }, [data, 'information']),
    ...(sharing ? [claim('sharesWith', {
      party: id === 'Stripe' ? 'Customer’s bank' : 'Service providers',
      purpose: id === 'Stripe' ? 'Authenticate and process payments' : 'Provide contracted services for the publisher',
    }, [sharing])] : []),
    ...(transfer ? [claim('destinations', { country: 'United States',
      note: 'This privacy notice names the United States as a processing or hosting location.' }, [transfer])] : []),
    ...(id === 'Sentry' ? [claim('destinations', { country: 'Germany',
      note: 'Sentry lists Germany as a hosting location for its site and service.' }, [transfer])] : []),
  ];
});
