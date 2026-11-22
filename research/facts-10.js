const adobe = 'https://developer.adobe.com/document-services/faq/tech-support/';
const network = 'https://unpkg.com/network';
const spotify = 'https://www.spotify.com/kr-en/legal/korea-entrustmentandtransfers/';
const make = (id, url, section, claim, terms) => ({
  id, url, section, claim, company: true, publisher: id, terms, creation: [id],
});
module.exports = [
  make('Adobe', adobe, 'sharesWith', {
    party: 'Amazon Web Services', purpose: 'Host identity data and temporarily store some content for Acrobat Services',
  }, ['Adobe', 'User-generated content', 'AWS US-East', 'identity data is on the AWS network']),
  ...['United States', 'Ireland', 'Singapore'].map((country) =>
    make('Adobe', adobe, 'destinations', {
      country, note: 'Adobe’s Acrobat Services FAQ lists this country for replicated identity data.',
    }, ['Adobe', 'identity data is on the AWS network', 'Virginia (US-East)', 'Ireland (EU-West)', 'Singapore (AP-Southeast)'])),
  make('unpkg', network, 'sharesWith', {
    party: 'Cloudflare', purpose: 'Serve incoming CDN requests using its edge network',
  }, ['UNPKG', "Requests are answered by Cloudflare's global network"]),
  ...['Sweden', 'United States'].map((country) => ({
    ...make('Akamai Technologies', spotify, 'destinations', {
      country, note: 'Spotify’s Korea disclosure lists this country for storage and file sharing by Akamai Technologies AB.',
    }, ['Spotify', 'Akamai Technologies AB', 'Data storage and file-sharing Sweden, United States of America']),
    publisher: 'Spotify',
  })),
];
