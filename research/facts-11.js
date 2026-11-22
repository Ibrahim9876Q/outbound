const facts = [];
function app(id, publisher, url, specs, creation) {
  for (const [section, value, purpose, ...evidence] of specs) {
    const claim = section === 'declared' ? { data: value, purpose } :
      section === 'sharesWith' ? { party: value, purpose } : { country: value, note: purpose };
    facts.push({ id, publisher, url, section, claim, terms: evidence, creation });
  }
}
const share = (purpose, term = 'service providers') => ['sharesWith', 'Service providers', purpose, term];
const us = (note, ...terms) => ['destinations', 'United States', note, ...terms];
const availability = 'Provide and support the service';
const microsoft = 'https://privacy.microsoft.com/en-us/privacystatement';
const google = 'https://policies.google.com/privacy/frameworks?hl=en';
const adobe = 'https://developer.adobe.com/document-services/faq/tech-support/';
const tiktok = 'https://newsroom.tiktok.com/tiktok-facts-how-we-secure-personal-information-and-store-data?lang=en';
const appStore = 'https://apps.apple.com/us/app/';

app('steam', 'Valve', 'https://store.steampowered.com/privacy_agreement/', [
  ['sharesWith', 'Third-party payment providers', 'Process payments', 'Valve', 'payment service provider'],
  us('Valve identifies the US as a possible location for shared or processed personal data.', 'Valve', 'United States', 'personal data'),
]);
app('zoom', 'Zoom', 'https://www.zoom.com/en/trust/privacy/privacy-statement/', [
  share(availability, 'service providers'),
  us('Zoom identifies the United States as a possible processing or storage location.', 'United States', 'stored'),
]);
app('slack', 'Slack', 'https://slack.com/trust/privacy/privacy-policy', [
  share('Provide services such as computing and storage', 'Third-Party service providers and partners'),
]);
app('onedrive', 'Microsoft', microsoft, [
  share('Microsoft’s notice covering OneDrive describes using providers acting on its behalf.', 'service providers acting on our behalf'),
  us('Microsoft’s general notice covering OneDrive names the US as a possible processing location.',
    'OneDrive', 'stored and processed in your region, in the United States'),
]);
app('dropbox', 'Dropbox', 'https://www.dropbox.com/privacy', [
  ['sharesWith', 'Trusted third parties', 'Help provide and protect Dropbox services', 'trusted third parties', 'provide'],
  us('Dropbox’s notice names the US as a location where it may store, process and transmit information.', 'store, process, and transmit', 'United States'),
]);
app('instagram', 'Instagram, Inc.', appStore + 'instagram/id389801252', [
  ['declared', 'Contact information and identifiers', 'The developer lists these categories in its App Store privacy label.',
    'Instagram', 'Data Linked to You', 'Contact Info', 'Identifiers'],
]);
app('instagram', 'Meta', 'https://about.fb.com/news/2022/05/metas-updated-privacy-policy/', [
  ['sharesWith', 'Third parties', 'Meta’s policy update describes sharing information and names law enforcement as one recipient category.',
    'Instagram', 'share information with law enforcement'],
]);
app('tiktok', 'TikTok', 'https://newsroom.tiktok.com/mythbusting-the-facts-on-reports-about-our-data-collection-practices-ca?lang=en-CA', [
  ['declared', 'Approximate location when Location Services is enabled in Canada',
    'Canadian disclosure about optional location collection', 'TikTok collects approximate location information', 'Location Services is actively enabled'],
]);
app('tiktok', 'TikTok', tiktok, [
  ['sharesWith', 'Oracle', 'Provide cloud infrastructure, as described for newly collected US user data in October 2023',
    'October 12, 2023', 'all new U.S. user data is stored automatically', 'Oracle'],
]);
app('snapchat', 'Snap Inc.', 'https://values.snap.com/privacy/privacy-policy', [
  share('Support Snapchat and other Snap services', 'service providers'),
]);
app('whatsapp', 'WhatsApp Inc.', appStore + 'whatsapp-messenger/id310633997', [
  ['declared', 'Contact information and identifiers', 'The developer lists these categories in its App Store privacy label.',
    'WhatsApp', 'Data Linked to You', 'Contact Info', 'Identifiers'],
]);
app('whatsapp', 'WhatsApp', 'https://www.whatsapp.com/legal/privacy-policy?lang=en&lg=en', [
  ['sharesWith', 'Third-party providers and other Meta companies', 'Provide technical infrastructure and support.',
    'we share information with third-party service providers', 'to provide technical infrastructure'],
  us('WhatsApp names the US as a place it may transfer, store or process information.',
    'stored and processed in, the United States'),
]);
app('telegram', 'Telegram', 'https://telegram.org/privacy', [
  ['sharesWith', 'Telegram group companies', 'Provide, improve and support the service', 'relevant group companies', 'Telegram Group Inc'],
  ['destinations', 'Netherlands', 'Telegram says data for certain users is stored in Netherlands data centres.',
    'data centers in the Netherlands', 'If you signed up for Telegram'],
]);
app('youtube', 'Google', google, [
  us('Google describes use of the EU–U.S. Data Privacy Framework for covered transfers.',
    'Google', 'EU-U.S. and Swiss-U.S. Data Privacy Frameworks', 'personal information'),
]);
app('netflix', 'Netflix', 'https://help.netflix.com/legal/privacy', [
  share('Provide services used to operate Netflix', 'Service Providers'),
  us('Netflix’s privacy statement describes international transfers of personal information.', 'Netflix', 'United States', 'International Transfers'),
]);
app('epic-games', 'Epic Games', 'https://legal.epicgames.com/epicgames/privacy-policy?lang=en-US', [
  ['declared', 'Account and device information', 'Operate Epic games and services', 'Epic', 'device', 'account'],
  share('Providers support Epic services', 'service providers'),
  us('Epic describes processing information in the United States.', 'Epic', 'United States', 'transfer'),
]);
app('riot-vanguard', 'Riot Games', 'https://www.riotgames.com/en/privacy-notice', [
  ['declared', 'Device and gameplay information', 'Riot describes using technical data for service integrity and to prevent cheating.', 'device', 'cheating', 'Riot Games'],
  share('Provide and support Riot’s services', 'service providers'),
  us('Riot’s publisher-wide notice describes processing personal data abroad, including in the US.', 'United States', 'transfer'),
], ['Riot Vanguard', 'Riot Games', 'anti-cheat', 'riotgames.com']);
app('nvidia', 'NVIDIA', 'https://www.nvidia.com/en-us/about-nvidia/privacy-policy/', [
  ['declared', 'Device or system information', 'NVIDIA’s publisher policy describes technical data processed across its services.', 'NVIDIA', 'device', 'system information'],
  share('Operate NVIDIA services', 'service providers'),
  us('NVIDIA’s publisher policy describes transfers involving its US operations.', 'NVIDIA', 'United States', 'transfer'),
], ['NVIDIA App', 'NVIDIA', 'Windows app', 'nvidia.com']);
app('nvidia', 'NVIDIA', 'https://nvidia.custhelp.com/app/answers/detail/a_id/3188', [
  ['declared', 'System and software information', 'NVIDIA describes information the NVIDIA App sends to support its features.', 'NVIDIA App', 'system', 'software'],
], ['NVIDIA App', 'NVIDIA', 'Windows app', 'nvidia.com']);
app('netflix', 'Netflix', 'https://help.netflix.com/legal/personal-information-international-transfers', [
  us('Netflix names the United States in its guidance about international transfers.',
    'Netflix', 'United States', 'personal information'),
]);
app('zoom', 'Zoom', 'https://www.zoom.com/en/trust/subprocessors/', [
  ['sharesWith', 'Amazon Web Services', 'Provide cloud infrastructure as a listed Zoom subprocessor.',
    'Amazon Web Services', 'Cloud Service Provider'],
]);
app('acrobat-reader', 'Adobe', appStore + 'adobe-acrobat-reader-edit-pdf/id469337564', [
  ['declared', 'Contact information and user content', 'Adobe’s App Store privacy label for Acrobat Reader lists these data categories.',
    'Adobe Acrobat', 'Data Linked to You', 'Contact Info', 'User Content'],
], ['Adobe Acrobat Reader', 'Adobe', 'productivity', 'adobe.com']);
app('acrobat-reader', 'Adobe', adobe, [
  ['sharesWith', 'Amazon Web Services', 'Host Acrobat Services identity data', 'identity data is on the AWS network'],
  us('Adobe lists US locations for Acrobat Services identity data.', 'identity data is on the AWS network', 'Virginia (US-East)'),
]);
app('grammarly', 'Grammarly', 'https://www.grammarly.com/privacy-policy', [
  share('Provide the services described in Grammarly’s notice'),
  us('Grammarly’s notice addresses processing in the United States.', 'Grammarly', 'United States', 'process'),
]);
app('notion', 'Notion Labs', 'https://www.notion.com/trust/privacy-policy', [
  ['declared', 'Account and profile information', 'Provide the Notion workspace service', 'Account', 'Notion', 'information'],
  share('Provide the workspace and support services'),
  us('Notion describes processing or transferring personal information in the US.', 'Notion', 'United States', 'transfer'),
], ['Notion', 'Notion Labs', 'productivity', 'notion.so']);
app('canva', 'Canva', 'https://www.canva.com/policies/privacy-policy/', [
  share('Provide Canva’s service and supporting infrastructure'),
  ['destinations', 'Australia', 'Canva’s notice identifies Australia as a country where data may be processed.',
    'Canva', 'Australia', 'transferred'],
]);
module.exports = facts;
