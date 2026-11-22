// Candidates identified in the US Microsoft Store free-app charts and Steam's most-played chart.
const microsoft = 'https://privacy.microsoft.com/en-us/privacystatement';
const apple = 'https://www.apple.com/legal/privacy/en-ww/';
const valve = 'https://store.steampowered.com/privacy_agreement/';
const ea = 'https://www.ea.com/legal/privacy-and-cookie-policy';
const rockstar = 'https://www.rockstargames.com/privacy';
const ubisoft = 'https://legal.ubi.com/privacypolicy/';
const row = (id, name, publisher, category, url, data, purpose, terms) =>
  [id, name, publisher, category, null, null, url, data, purpose, terms];
const ms = (id, name) => row(id, name, 'Microsoft', 'Windows app', microsoft, 'Device and diagnostic data',
  'Microsoft describes collecting this data across its products for operation and diagnostics.', ['Microsoft', 'device identifiers', 'diagnostic data']);
const ap = (id, name) => row(id, name, 'Apple', 'Windows app', apple, 'Device data and account details',
  'Apple’s general notice describes processing these categories to provide and develop its services.', ['Apple', 'Device Data', 'Account Information']);
const va = (id, name) => row(id, name, 'Valve', 'PC game', valve, 'Steam account and gameplay data',
  'Valve’s Steam policy describes using these data to provide Steam services and game features.', ['Valve', 'Steam', 'gameplay']);
const rt = (id, name) => row(id, name, 'Rockstar Games', 'PC game', rockstar, 'Gameplay information and online identifiers',
  'Rockstar describes processing these categories across its products and services.', ['Rockstar', 'gameplay', 'IP address']);

module.exports = [
  ap('itunes', 'iTunes'),
  ap('apple-devices', 'Apple Devices'),
  ms('windows-scan', 'Windows Scan'),
  ms('windows-app', 'Windows App'),
  ms('clipchamp', 'Microsoft Clipchamp'),
  ms('microsoft-photos', 'Microsoft Photos'),
  ms('bing-wallpaper', 'Bing Wallpaper'),
  row('acrobat-reader', 'Adobe Acrobat Reader DC', 'Adobe', 'Windows app', 'https://www.adobe.com/privacy/privacy-notice.html', 'Device information', 'Run Adobe software and services', ['Adobe', 'device', 'IP address']),
  row('lively-wallpaper','Lively Wallpaper','rocksdanister','Windows app','https://github.com/rocksdanister/lively/wiki/Privacy-Policy','Wallpaper application privacy policy','The developer describes how Lively handles user information.',['Lively','privacy','collect']),
  row('nvidia-control-panel','NVIDIA Control Panel','NVIDIA','Windows app','https://www.nvidia.com/en-us/about-nvidia/privacy-policy/','Device and system information','NVIDIA describes processing device information across its products and services.',['NVIDIA','device','system information']),
  row('vlc','VLC','VideoLAN','Windows app','https://www.videolan.org/privacy.html','Developer privacy disclosures','VideoLAN explains how VLC handles user information.',['VideoLAN','VLC','collect']),
  row('epson-print-scan','Epson Print and Scan','Epson','Windows app','https://epson.com/privacy-policy','Device and usage information','Epson describes processing these categories in its privacy notice.',['Epson','device','usage']),
  row('picsart','Picsart Photo Editor','Picsart','Windows app','https://picsart.com/privacy-policy','Account and device information','Provide Picsart services',['Picsart','device','account']),
  row('filmora','Wondershare Filmora','Wondershare','Windows app','https://www.wondershare.com/privacy.html','Device and usage information','Wondershare describes processing these categories for its software.',['Wondershare','device','usage']),
  va('counter-strike-2', 'Counter-Strike 2'),
  va('dota-2', 'Dota 2'),
  va('team-fortress-2', 'Team Fortress 2'),
  va('deadlock', 'Deadlock'),
  rt('gta-v-enhanced', 'Grand Theft Auto V Enhanced'),
  rt('red-dead-redemption-2', 'Red Dead Redemption 2'),
  row('apex-legends','Apex Legends','Electronic Arts','PC game',ea,'Account and gameplay information','EA describes processing these categories across its games.',['Electronic Arts','gameplay','account']),
  row('rainbow-six-siege','Rainbow Six Siege','Ubisoft','PC game',ubisoft,'Game and device usage','Ubisoft describes collecting data when players use its services.',['Ubisoft','device','play']),
  row('warframe','Warframe','Digital Extremes','PC game','https://www.warframe.com/privacy','Account and usage information','Provide and administer Warframe',['Warframe','account','usage']),
  row('vrchat','VRChat','VRChat','PC game','https://hello.vrchat.com/privacy','Account and device information','Provide VRChat services',['VRChat','account','device']),
  row('cyberpunk-2077','Cyberpunk 2077','CD Projekt Red','PC game','https://www.cdprojekt.com/en/privacy-policy/','Account and usage information','CD Projekt explains its processing across its services.',['CD Projekt','account','usage']),
  row('pubg','PUBG: Battlegrounds','Krafton','PC game','https://pubg.com/en/clause/privacy_policy','Account and device information','Provide and secure PUBG',['PUBG','account','device']),
  row('call-of-duty','Call of Duty','Activision','PC game','https://www.activision.com/legal/privacy-policy','Account and gameplay data','Activision describes using these categories to provide its games and services.',['Activision','account','gameplay']),
  row('overwatch','Overwatch','Blizzard','PC game','https://www.blizzard.com/en-us/legal/privacy','Account and game information','Blizzard describes how it processes information for its games and services.',['Blizzard','account','games']),
];
