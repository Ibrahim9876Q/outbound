// City centers for corporate headquarters. Names match service and network labels.
// TikTok lists two global headquarters: https://www.bytedance.com/products-services?locale=en
// Oracle's principal offices: https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/orcl-20260531.htm
const companies = [
  ['Google', [['Mountain View, US', 37.39, -122.08]], 'Alphabet', 'Google LLC', 'Google Cloud', 'Google Analytics', 'Google Tag Manager', 'Google Ads', 'Google Ads (DoubleClick)', 'Google Firebase Analytics', 'Google (YouTube)', 'YouTube'],
  ['Microsoft', [['Redmond, US', 47.67, -122.12]], 'Microsoft Corporation', 'Microsoft Azure', 'Microsoft (Bing)', 'Microsoft (Xbox)', 'Azure'],
  ['Amazon', [['Seattle, US', 47.61, -122.33]], 'AWS', 'Amazon Web Services', 'Amazon CloudFront', 'Amazon.com'],
  ['Cloudflare', [['San Francisco, US', 37.77, -122.42]], 'Cloudflare Inc.'],
  ['Meta', [['Menlo Park, US', 37.45, -122.18]], 'Meta Platforms', 'Facebook', 'Meta (Instagram)', 'Meta (WhatsApp)'],
  ['Anthropic', [['San Francisco, US', 37.77, -122.42]], 'Anthropic PBC'],
  ['OpenAI', [['San Francisco, US', 37.77, -122.42]]],
  ['Akamai', [['Cambridge, US', 42.37, -71.11]], 'Akamai Technologies', 'Akamai (Linode)', 'Linode'],
  ['Fastly', [['San Francisco, US', 37.77, -122.42]], 'Fastly Inc.'],
  ['Apple', [['Cupertino, US', 37.32, -122.03]], 'Apple Inc.', 'iCloud'],
  ['ByteDance', [['Beijing, CN', 39.90, 116.41]]],
  ['TikTok', [['Los Angeles, US', 34.05, -118.24], ['Singapore', 1.35, 103.82]]],
  ['Tencent', [['Shenzhen, CN', 22.54, 114.06]], 'Tencent Cloud'],
  ['Alibaba', [['Hangzhou, CN', 30.27, 120.16]], 'Alibaba Cloud', 'Alibaba Group'],
  ['Discord', [['San Francisco, US', 37.77, -122.42]]],
  ['Spotify', [['Stockholm, SE', 59.33, 18.07]]],
  ['Zoom', [['San Jose, US', 37.34, -121.89]], 'Zoom Communications', 'Zoom Video Communications'],
  ['Adobe', [['San Jose, US', 37.34, -121.89]], 'Adobe Inc.'],
  ['Oracle', [['Austin, US', 30.27, -97.74]], 'Oracle Cloud', 'Oracle Corporation'],
  ['Salesforce', [['San Francisco, US', 37.77, -122.42]], 'Slack'],
  ['X (Twitter)', [['Bastrop, US', 30.11, -97.32]], 'Twitter', 'Twitter Inc.', 'X Corp.', 'X'],
  ['Snap', [['Santa Monica, US', 34.02, -118.49]], 'Snapchat', 'Snap Inc.'],
  ['Yandex', [['Moscow, RU', 55.75, 37.62]]],
  ['Baidu', [['Beijing, CN', 39.90, 116.41]]],
  ['Samsung Electronics', [['Suwon, KR', 37.26, 127.03]], 'Samsung'],
  ['Netflix', [['Los Gatos, US', 37.24, -121.96]]],
  ['NVIDIA', [['Santa Clara, US', 37.35, -121.96]]],
  ['Intel', [['Santa Clara, US', 37.35, -121.96]]],
  ['IBM', [['Armonk, US', 41.13, -73.71]]],
  ['Cisco', [['San Jose, US', 37.34, -121.89]], 'Cisco Systems'],
  ['GitHub', [['San Francisco, US', 37.77, -122.42]]],
  ['Dropbox', [['San Francisco, US', 37.77, -122.42]]],
  ['Reddit', [['San Francisco, US', 37.77, -122.42]]],
  ['Shopify', [['Ottawa, CA', 45.42, -75.70]]],
  ['Vultr', [['West Palm Beach, US', 26.72, -80.05]], 'The Constant Company'],
  ['OVHcloud', [['Roubaix, FR', 50.69, 3.18]], 'OVH', 'OVH SAS'],
  ['Hetzner', [['Gunzenhausen, DE', 49.11, 10.75]], 'Hetzner Online'],
  ['Valve', [['Bellevue, US', 47.61, -122.20]], 'Valve (Steam)', 'Valve Corporation', 'Steam'],
  ['Uber', [['San Francisco, US', 37.77, -122.42]], 'Uber Technologies'],
  ['Twitch', [['San Francisco, US', 37.77, -122.42]], 'Twitch Interactive'],
];

const byName = new Map();
for (const [owner, cities, ...aliases] of companies) {
  const headquarters = cities.map(([city, lat, lng]) => ({ owner, city, lat, lng }));
  for (const name of [owner, ...aliases]) byName.set(normalize(name), headquarters);
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function headquartersFor(name) {
  return byName.get(normalize(name)) || [];
}
