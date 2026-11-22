// Maps hostnames to the company behind them, and flags known trackers.

// Hostname suffix -> company. First match wins, so put specific entries first.
const ORG_SUFFIXES = [
  ['google-analytics.com', 'Google Analytics'],
  ['googletagmanager.com', 'Google Tag Manager'],
  ['doubleclick.net', 'Google Ads (DoubleClick)'],
  ['googlesyndication.com', 'Google Ads'],
  ['googleadservices.com', 'Google Ads'],
  ['app-measurement.com', 'Google Firebase Analytics'],
  ['googleusercontent.com', 'Google Cloud'],
  ['1e100.net', 'Google'],
  ['googleapis.com', 'Google'],
  ['gstatic.com', 'Google'],
  ['google.com', 'Google'],
  ['youtube.com', 'Google (YouTube)'],
  ['ytimg.com', 'Google (YouTube)'],
  ['fbcdn.net', 'Meta'],
  ['facebook.com', 'Meta'],
  ['facebook.net', 'Meta'],
  ['instagram.com', 'Meta (Instagram)'],
  ['whatsapp.net', 'Meta (WhatsApp)'],
  ['whatsapp.com', 'Meta (WhatsApp)'],
  ['cloudfront.net', 'Amazon CloudFront'],
  ['amazonaws.com', 'Amazon Web Services'],
  ['amazon.com', 'Amazon'],
  ['a2z.com', 'Amazon'],
  ['akamaitechnologies.com', 'Akamai'],
  ['akamaiedge.net', 'Akamai'],
  ['akamai.net', 'Akamai'],
  ['edgekey.net', 'Akamai'],
  ['cloudflare.com', 'Cloudflare'],
  ['cloudflare.net', 'Cloudflare'],
  ['fastly.net', 'Fastly'],
  ['azureedge.net', 'Microsoft Azure'],
  ['cloudapp.azure.com', 'Microsoft Azure'],
  ['azure.com', 'Microsoft Azure'],
  ['msedge.net', 'Microsoft'],
  ['microsoft.com', 'Microsoft'],
  ['windows.com', 'Microsoft'],
  ['windowsupdate.com', 'Microsoft'],
  ['live.com', 'Microsoft'],
  ['office.com', 'Microsoft'],
  ['office.net', 'Microsoft'],
  ['skype.com', 'Microsoft'],
  ['bing.com', 'Microsoft (Bing)'],
  ['msn.com', 'Microsoft (MSN)'],
  ['xboxlive.com', 'Microsoft (Xbox)'],
  ['discord.gg', 'Discord'],
  ['discord.com', 'Discord'],
  ['discordapp.com', 'Discord'],
  ['discordapp.net', 'Discord'],
  ['discord.media', 'Discord'],
  ['spotify.com', 'Spotify'],
  ['scdn.co', 'Spotify'],
  ['spotifycdn.com', 'Spotify'],
  ['steampowered.com', 'Valve (Steam)'],
  ['steamcontent.com', 'Valve (Steam)'],
  ['steamserver.net', 'Valve (Steam)'],
  ['valvesoftware.com', 'Valve'],
  ['apple.com', 'Apple'],
  ['icloud.com', 'Apple'],
  ['github.com', 'GitHub'],
  ['githubusercontent.com', 'GitHub'],
  ['anthropic.com', 'Anthropic'],
  ['claude.ai', 'Anthropic'],
  ['openai.com', 'OpenAI'],
  ['tiktokcdn.com', 'TikTok'],
  ['tiktok.com', 'TikTok'],
  ['byteoversea.com', 'ByteDance'],
  ['snapchat.com', 'Snap'],
  ['twitter.com', 'X (Twitter)'],
  ['x.com', 'X (Twitter)'],
  ['twimg.com', 'X (Twitter)'],
  ['reddit.com', 'Reddit'],
  ['redditmedia.com', 'Reddit'],
  ['adobe.com', 'Adobe'],
  ['adobe.io', 'Adobe'],
  ['zoom.us', 'Zoom'],
  ['slack.com', 'Slack'],
  ['epicgames.com', 'Epic Games'],
  ['riotgames.com', 'Riot Games'],
  ['nvidia.com', 'NVIDIA'],
  ['dropbox.com', 'Dropbox'],
  ['digitaloceanspaces.com', 'DigitalOcean'],
  ['vultr.com', 'Vultr'],
];

// Ad, analytics and data-collection services. Hits on these are flagged as trackers.
const TRACKER_SUFFIXES = [
  'doubleclick.net', 'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com',
  'googleadservices.com', 'app-measurement.com', 'adservice.google.com', 'graph.facebook.com',
  'connect.facebook.net', 'an.facebook.com', 'scorecardresearch.com', 'adnxs.com', 'criteo.com',
  'criteo.net', 'taboola.com', 'outbrain.com', 'hotjar.com', 'hotjar.io', 'mixpanel.com',
  'segment.io', 'segment.com', 'amplitude.com', 'branch.io', 'adjust.com', 'appsflyer.com',
  'forter.com', 'braze.com', 'onesignal.com', 'rubiconproject.com', 'pubmatic.com',
  'casalemedia.com', 'quantserve.com', 'moatads.com', 'demdex.net', 'omtrdc.net',
  'everesttech.net', 'bluekai.com', 'krxd.net', 'adsrvr.org', 'bidswitch.net', 'openx.net',
  'smartadserver.com', 'yieldmo.com', 'tapad.com', 'liveramp.com', 'rlcdn.com',
  'clarity.ms', 'bat.bing.com', 'ads.linkedin.com', 'analytics.tiktok.com', 'sentry.io',
  'newrelic.com', 'nr-data.net', 'datadoghq.com', 'bugsnag.com', 'crashlytics.com',
  'firebaseinstallations.googleapis.com', 'firebaselogging.googleapis.com', 'vortex.data.microsoft.com',
  'telemetry.microsoft.com', 'events.data.microsoft.com', 'browser.events.data.msn.com',
];

// Vendor and measurement references:
// https://iabeurope.eu/vendor-list/
// https://mapping.iabeurope.eu/am
// https://www.iab.com/iab-global-network-worldwide-members/
// https://ico.org.uk/media/action-weve-taken/2618470/investigation-into-data-protection-compliance-in-the-direct-marketing-data-broking-sector.pdf
// Include legacy names seen in ASN attribution. A match is a clue about the owner.
const TRACKER_ORGS = {
  ads: [
    'rubicon project', 'rubicon', 'outbrain', 'pubmatic', 'criteo', 'appnexus', 'taboola',
    'the trade desk', 'conversant', 'pulsepoint', 'rtb marketing and tech services',
    'deepintent', 'adform', 'rocket fuel', 'rhythmone', 'oath holdings', 'yahoo ads',
    'verizon media', 'index exchange', 'openx', 'sovrn', 'magnite', 'quantcast',
    'mediamath', 'smaato', 'inmobi', 'applovin', 'ironsource', 'unity ads', 'sharethrough',
    'triplelift', 'gumgum', 'kargo', '33across', 'zeta global', 'zeta', 'media net',
    'teads', 'sizmek', 'bidswitch', 'iponweb', 'smart ad server', 'equativ',
    'improve digital', 'yieldmo', 'undertone', 'vungle', 'liftoff', 'xandr',
  ],
  analytics: [
    'samba tv', 'comscore', 'scorecardresearch', 'scorecard', 'branch metrics', 'branch',
    'appsflyer', 'adjust', 'yandex metrica', 'yandex metrika', 'integral ad science',
    'doubleverify', 'moat', 'nielsen', 'new relic', 'datadog', 'sentry', 'functional software',
    'mixpanel', 'amplitude', 'forter', 'hotjar', 'braze', 'segment', 'bugsnag', 'onesignal',
  ],
  'data broker': ['lotame', 'liveramp', 'oracle advertising', 'oracle data cloud', 'bluekai', 'experian', 'acxiom', 'tapad'],
};

function normalizeOrg(org) {
  return org.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

const trackerOrgPatterns = Object.entries(TRACKER_ORGS).flatMap(([category, aliases]) =>
  aliases.map((alias) => [category, new RegExp(`(?:^| )${normalizeOrg(alias).replaceAll(' ', ' *')}(?: |$)`)]));

function trackerCategory(org) {
  if (typeof org !== 'string') return null;
  const normalized = normalizeOrg(org);
  return trackerOrgPatterns.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}

function isTrackerOrg(org) {
  return trackerCategory(org) !== null;
}

function matchSuffix(host, suffix) {
  return host === suffix || host.endsWith('.' + suffix);
}

function orgForHost(host) {
  if (!host) return null;
  host = host.toLowerCase().replace(/\.$/, '');
  for (const [suffix, org] of ORG_SUFFIXES) if (matchSuffix(host, suffix)) return org;
  return null;
}

function isTracker(host) {
  if (!host) return false;
  host = host.toLowerCase().replace(/\.$/, '');
  return TRACKER_SUFFIXES.some((s) => matchSuffix(host, s));
}

// "edge-star-mini-shv-01-yyz1.facebook.com" -> "facebook.com"
function baseDomain(host) {
  if (!host) return null;
  const parts = host.toLowerCase().replace(/\.$/, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const twoPartTlds = ['co.uk', 'com.au', 'co.jp', 'com.br', 'co.in', 'gc.ca', 'on.ca'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTlds.includes(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

// Readable names for common executables when Windows gives no description.
const FRIENDLY_APPS = {
  'chrome': 'Google Chrome', 'msedge': 'Microsoft Edge', 'firefox': 'Firefox', 'brave': 'Brave',
  'opera': 'Opera', 'discord': 'Discord', 'spotify': 'Spotify', 'steam': 'Steam',
  'steamwebhelper': 'Steam', 'code': 'VS Code', 'slack': 'Slack', 'teams': 'Microsoft Teams',
  'ms-teams': 'Microsoft Teams', 'zoom': 'Zoom', 'onedrive': 'OneDrive', 'explorer': 'File Explorer',
  'svchost': 'Windows Services', 'system': 'Windows Kernel', 'searchhost': 'Windows Search',
  'msedgewebview2': 'Edge WebView', 'whatsapp': 'WhatsApp', 'claude': 'Claude', 'node': 'Node.js',
  'python': 'Python', 'epicgameslauncher': 'Epic Games', 'riotclientservices': 'Riot Client',
  'nvcontainer': 'NVIDIA Container', 'lsass': 'Windows Security', 'wininit': 'Windows',
  'powershell': 'PowerShell', 'pwsh': 'PowerShell', 'outlook': 'Outlook', 'olk': 'Outlook',
};

function friendlyAppName(exeName, description) {
  const base = exeName.replace(/\.exe$/i, '');
  const known = FRIENDLY_APPS[base.toLowerCase()];
  if (known) return known;
  if (description && description.trim()) return description.trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

module.exports = { orgForHost, isTracker, isTrackerOrg, trackerCategory, baseDomain, friendlyAppName };
