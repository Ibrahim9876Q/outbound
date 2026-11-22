// Additional leads from Apple's US charts and related publisher product disclosures.
const google = 'https://policies.google.com/privacy?hl=en-US';
const microsoft = 'https://privacy.microsoft.com/en-us/privacystatement';
const row = (id,name,publisher,category,domain,url,data,purpose,terms) =>
  [id,name,publisher,category,null,domain,url,data,purpose,terms];
module.exports = [
  row('claude','Claude','Anthropic','ai','claude.ai','https://www.anthropic.com/legal/privacy','Prompts and account information','Provide and maintain Claude',['anthropic','inputs','provide']),
  row('vinted','Vinted','Vinted','shopping','vinted.com','https://www.vinted.com/privacy-policy','Account and transaction data','Provide marketplace services',['vinted','transaction','account']),
  row('google-search','Google Search','Google','search','google.com',google,'Search terms and activity','Provide results and personalize services',['google','terms you search for','provide our services']),
  row('google-home','Google Home','Google','smart home','home.google.com',google,'Voice and audio information when using audio features','Operate Google products and services',['google home','voice and audio information','provide our services']),
  row('gmail','Gmail','Google','email','mail.google.com',google,'Email content stored through Google services','Provide mail features and process requests',['gmail','emails you write and receive','provide our services']),
  row('gemini','Google Gemini','Google','ai','gemini.google.com','https://support.google.com/gemini/answer/13594961?hl=en','Prompts and Gemini Apps activity','Provide Gemini Apps and improve services',['gemini apps','prompts','improve']),
  row('playstation','PlayStation App','Sony Interactive Entertainment','games','playstation.com','https://www.playstation.com/en-us/legal/privacy-policy/','Account and device information','Operate PlayStation services',['playstation','device','account']),
  row('walmart','Walmart','Walmart','shopping','walmart.com','https://corporate.walmart.com/privacy-security/walmart-privacy-notice','Purchase and device information','Fill orders and operate services',['walmart','device','purchase']),
  row('shop','Shop','Shopify','shopping','shop.app','https://www.shopify.com/legal/privacy/app-users','Contact and purchase information','Provide order and shipping services',['shop','purchase','order']),
  row('capital-one','Capital One Mobile','Capital One','finance','capitalone.com','https://www.capitalone.com/privacy/online-privacy-policy/','Device and online activity information','Operate and secure online services',['capital one','device','security']),
  row('whatnot','Whatnot','Whatnot','shopping','whatnot.com','https://www.whatnot.com/privacy','Account and order information','Run marketplace transactions',['whatnot','order','account']),
  row('kalshi','Kalshi','Kalshi','finance','kalshi.com','https://kalshi.com/privacy','Identity and transaction information','Run its market and comply with legal obligations',['kalshi','transaction','legal']),
  row('xbox','Xbox','Microsoft','games','xbox.com',microsoft,'Gameplay, account and device data','Operate Xbox features and multiplayer services',['xbox','gameplay','multiplayer']),
  row('bing','Bing','Microsoft','search','bing.com',microsoft,'Search queries and related activity','Provide Bing search results',['bing','search queries','search results']),
  row('outlook','Outlook','Microsoft','email','outlook.com',microsoft,'Email messages and related information','Provide Outlook mail services',['outlook','email','messages']),
  row('google-photos','Google Photos','Google','photo','photos.google.com',google,'Images and videos uploaded by the user','Provide photo storage and related features',['google photos','photos and videos','upload']),
  row('apple-maps','Apple Maps','Apple','navigation','maps.apple.com','https://www.apple.com/legal/privacy/data/en/apple-maps/','Location and navigation requests','Provide routes and improve Maps',['maps','location','route']),
  row('apple-music','Apple Music','Apple','music','music.apple.com','https://www.apple.com/legal/privacy/data/en/apple-music/','Listening activity','Provide and personalize Apple Music',['apple music','listen','personaliz']),
  row('apple-tv','Apple TV','Apple','video','tv.apple.com','https://www.apple.com/legal/privacy/data/en/apple-tv-app/','Viewing activity','Provide and personalize video recommendations',['apple tv','watch','recommendations']),
  row('apple-podcasts','Apple Podcasts','Apple','music','podcasts.apple.com','https://www.apple.com/legal/privacy/data/en/apple-podcasts/','Listening activity','Provide and personalize podcast recommendations',['apple podcasts','listen','recommendations']),
  row('amazon-music','Amazon Music','Amazon','music','music.amazon.com','https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ','Interactions with Amazon services','Provide and personalize Amazon services',['amazon music','personalize','amazon services']),
  row('kindle','Kindle','Amazon','books','amazon.com','https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ','Reading progress on Kindle services','Synchronize reading and provide Amazon services',['kindle','reading','progress']),
  row('duckduckgo','DuckDuckGo','DuckDuckGo','browser','duckduckgo.com','https://duckduckgo.com/privacy','Anonymous product usage measurement','Improve DuckDuckGo services',['duckduckgo','anonymous','improve']),
  row('proton-mail','Proton Mail','Proton','email','proton.me','https://proton.me/mail/privacy-policy','Account data and service metadata','Operate and protect Proton Mail',['proton mail','account','metadata']),
  row('proton-vpn','Proton VPN','Proton','security','protonvpn.com','https://protonvpn.com/privacy-policy','Account information','Provide subscriptions and operate the VPN',['proton vpn','account','subscription']),
  row('booking','Booking.com','Booking.com','travel','booking.com','https://www.booking.com/content/privacy.html','Reservation and contact information','Arrange bookings and customer support',['booking.com','reservation','customer support']),
  row('airbnb','Airbnb','Airbnb','travel','airbnb.com','https://www.airbnb.com/help/article/2855','Account and booking information','Provide and protect the marketplace',['airbnb','account information','provide']),
  row('expedia','Expedia','Expedia Group','travel','expedia.com','https://www.expedia.com/legal/privacy','Reservation and contact information','Arrange travel bookings',['expedia','booking','contact']),
  row('etsy','Etsy','Etsy','shopping','etsy.com','https://www.etsy.com/legal/privacy/','Account and purchase information','Operate marketplace services and transactions',['etsy','account','transaction']),
  row('ebay','eBay','eBay','shopping','ebay.com','https://www.ebay.com/help/policies/member-behavior-policies/user-privacy-notice-privacy-policy?id=4260','Account and transaction information','Provide marketplace services',['ebay','account','transaction']),
];
