import * as si from 'simple-icons';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
const want = 'instagram tiktok youtube facebook snapchat whatsapp google googlechrome spotify discord netflix threads messenger amazon x reddit pinterest twitch telegram signal steam epicgames zoom dropbox notion openai tinder uber airbnb paypal venmo duolingo roblox shazam soundcloud tumblr wechat line viber bereal bumble ebay etsy shopify temu shein capcut grammarly googlemaps gmail youtubemusic primevideo hulu disneyplus applemusic tidal deezer waze lyft doordash ubereats cashapp revolut coinbase binance robinhood strava fitbit garmin twitter quora medium substack patreon onlyfans kick riotgames valorant leagueoflegends nvidia brave firefox opera vivaldi duckduckgo'.split(' ');
const out = {};
for (const slug of want) {
  const key = 'si' + slug[0].toUpperCase() + slug.slice(1);
  const ic = si[key];
  if (!ic) { continue; }
  const svg = ic.svg.replace('<svg ', '<svg fill="#ffffff" ');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 160 } }).render().asPng();
  fs.writeFileSync(`../logos/${slug}.png`, png); out[slug] = { title: ic.title, hex: ic.hex };
}
fs.writeFileSync('../logos/index.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, Object.keys(out).join(' '));
