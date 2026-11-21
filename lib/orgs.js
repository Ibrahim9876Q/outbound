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

// Companies whose whole business is collecting usage, ad or analytics data.
const TRACKER_ORGS = [
  'new relic', 'datadog', 'sentry', 'functional software', 'mixpanel', 'amplitude', 'branch metrics',
  'appsflyer', 'adjust', 'criteo', 'taboola', 'outbrain', 'the trade desk', 'pubmatic', 'magnite',
  'rubicon', 'index exchange', 'forter', 'hotjar', 'braze', 'segment', 'liveramp', 'quantcast',
  'comscore', 'scorecard', 'openx', 'xandr', 'appnexus', 'bugsnag', 'onesignal', 'moat', 'doubleverify',
  'integral ad science', 'tapad', 'lotame', 'oracle data cloud', 'bluekai',
];

function isTrackerOrg(org) {
  if (!org) return false;
  const o = org.toLowerCase();
  return TRACKER_ORGS.some((t) => o.includes(t));
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

module.exports = { orgForHost, isTracker, isTrackerOrg, baseDomain, friendlyAppName };
