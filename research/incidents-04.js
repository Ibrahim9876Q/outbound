const ftc = 'Federal Trade Commission';
const dpc = 'Irish Data Protection Commission';
const cnil = 'CNIL';
const tx = 'Texas Office of the Attorney General';
const us = 'United States';
const eu = 'Ireland / EU';
const type = {
  company: (name) => [true, name, [name]],
  app: (id, creation) => [false, id, creation],
};
const item = ([company,id,creation],publisher,url,year,kind,title,jurisdiction,amount,summary,terms) => ({
  company,id,creation,publisher,url,section:'incidents',
  terms:[...terms,String(year),...(amount ? [amount.replace(/^USD /,'$')] : [])],
  claim:{year,kind,title,jurisdiction,...(amount ? {amount} : {}),summary},
});
const app = type.app;
const co = type.company;
const news = 'https://search.ftc.gov/news-events/news/press-releases/';
const d = 'https://www.dataprotection.ie/en/';
module.exports = [
  item(app('facebook'),ftc,news+'2019/07/ftc-imposes-5-billion-penalty-sweeping-new-privacy-restrictions-facebook',2019,'settlement','Facebook 2019 privacy order settlement',us,'USD 5 billion','Facebook agreed to a penalty and new privacy oversight to resolve alleged violations of its earlier FTC order.',['facebook','2012 privacy order']),
  item(co('Meta'),tx,'https://www.oag.state.tx.us/news/releases/attorney-general-ken-paxton-secures-14-billion-settlement-meta-over-its-unauthorized-capture',2024,'settlement','Texas Meta biometrics settlement',us,'USD 1.4 billion','Texas announced a settlement of allegations involving Facebook facial recognition and biometric consent.',['meta','facial recognition']),
  item(co('Google'),tx,'https://oag.state.tx.us/news/releases/attorney-general-ken-paxton-secures-historic-1375-billion-settlement-google-related-texans-data',2025,'settlement','Texas Google privacy settlement',us,'USD 1.375 billion','Texas announced a settlement of claims involving location, browsing and biometric data.',['google','biometric']),
  item(co('Google'),cnil,'https://www.cnil.fr/fr/publicites-inserees-entre-les-courriels-et-cookies-la-cnil-sanctionne-google-dune-amende-de-325',2025,'fine','CNIL Google email advertising and cookies decision','France',null,'The CNIL announced fines totaling €325 million involving ads placed between emails and cookie consent.', ['google','325 millions','courriels','cookies']),
  item(app('shein',['SHEIN','SHEIN','shopping','shein.com']),cnil,'https://www.cnil.fr/fr/regulation-des-cookies-la-cnil-poursuit-le-plan-daction-initie-en-2019-et-prononce-deux-amendes',2025,'fine','CNIL SHEIN cookies action','France',null,'The CNIL announced a separate cookie sanction against SHEIN as part of its cookie enforcement work.',['shein','cookies','sanction']),
  item(app('tiktok'),dpc,d+'news-media/latest-news/irish-data-protection-commission-fines-tiktok-eu530-million-and-orders-corrective-measures-following',2025,'fine','TikTok EEA data transfer inquiry',eu,'€530 million','The DPC announced a fine and corrective measures following an inquiry into TikTok transfers of EEA user data to China.',['tiktok','china','corrective']),
  item(app('tiktok'),'U.S. Department of Justice','https://www.justice.gov/archives/opa/pr/justice-department-sues-tiktok-and-parent-company-bytedance-widespread-violations-childrens',2024,'court','DOJ TikTok and ByteDance COPPA complaint',us,null,'The Justice Department filed a complaint alleging children’s privacy violations by TikTok and ByteDance.',['tiktok','bytedance','coppa','filed a civil lawsuit']),
  item(app('tiktok'),'Office of the Privacy Commissioner of Canada','https://www.priv.gc.ca/en/opc-news/news-and-announcements/2025/nr-c_250923/?wbdisable=true',2025,'investigation','Canadian joint TikTok privacy investigation','Canada',null,'Canadian regulators reported privacy concerns involving children’s data, age assurance and TikTok’s collection and use of personal information.',['tiktok','age','children']),
  item(app('uber',['Uber','Uber','transport','uber.com']),'Dutch Data Protection Authority','https://autoriteitpersoonsgegevens.nl/en/current/dutch-dpa-imposes-a-fine-of-290-million-euro-on-uber-because-of-transfers-of-drivers-data-to-the-us',2024,'fine','Uber European driver data transfers','Netherlands / EU','290 million euro','The Dutch DPA announced a fine over transfers of European drivers’ personal data to the United States.',['uber','drivers','transfers']),
  item(app('uber',['Uber','Uber','transport','uber.com']),ftc,news+'2018/10/federal-trade-commission-gives-final-approval-settlement-uber',2018,'settlement','Uber data security and breach settlement',us,null,'The FTC approved a settlement of allegations involving privacy and security practices, including Uber’s handling of a 2016 breach.',['uber','2016','breach']),
  item(app('zoom'),ftc,news+'2020/11/ftc-requires-zoom-enhance-its-security-practices-part-settlement',2020,'settlement','Zoom security claims settlement announced',us,null,'The FTC announced a proposed settlement over allegations that Zoom misrepresented its encryption and security practices.',['zoom','end-to-end','settlement']),
  item(app('grindr'),'Norwegian Data Protection Authority','https://www.datatilsynet.no/en/news/news-2025/the-court-of-appeal-upholds-the-fine-against-grindr/',2025,'court','Grindr fine upheld on appeal','Norway',null,'The authority reported that the Court of Appeal upheld the administrative penalty over Grindr’s sharing of user information for advertising.',['grindr','court of appeal','advertising']),
  item(app('spotify'),'Swedish Authority for Privacy Protection','https://www.imy.se/nyheter/sanktionsavgift-mot-spotify',2023,'fine','Spotify access transparency decision','Sweden',null,'The authority announced a SEK 58 million sanction concerning information Spotify supplied when individuals exercised access rights.',['spotify','58 miljoner','personuppgifter']),
  item(app('temu'),'Arkansas Attorney General','https://arkansasag.gov/news-release/attorney-general-griffin-sues-chinese-e-commerce-company-temu-for-deceiving-arkansans-illegally-accessing-their-personal-information/',2024,'court','Arkansas Temu privacy complaint',us,null,'Arkansas announced a lawsuit alleging deceptive access to personal information through the Temu app.',['temu','lawsuit','personal information']),
  item(co('Google'),dpc,d+'dpc-guidance/decisions/fines',2026,'fine','Irish Google location data fine entry',eu,'€403,000,000','The DPC register lists a fine for its inquiry into Google’s processing of location data and labels it not confirmed.',['google’s processing of location data','21/09/2026','not confirmed']),
  item(co('Meta'),dpc,d+'dpc-guidance/decisions/fines',2024,'fine','Irish Meta inquiry IN-18-10-1 and IN-18-11-1',eu,'€251,000,000','The DPC register lists combined fines under the two inquiry numbers with appeal pending.',['meta platforms ireland limited','in-18-10-1','in-18-11-1','pending appeal']),
  item(co('Meta'),dpc,d+'dpc-guidance/decisions/fines',2024,'fine','Irish Meta inquiry IN-22-4-1',eu,'€91,000,000','The DPC register lists an administrative fine for the Meta decision and records its appeal status.',['meta platforms ireland limited','26/09/2024','pending appeal']),
  item(app('x'),dpc,d+'dpc-guidance/decisions/fines',2020,'fine','Irish Twitter inquiry IN-19-1-1',eu,'€450,000','The DPC’s register lists this fine on Twitter International Company and records it as collected.',['twitter international company','in-19-1-1','collected']),
  item(co('Microsoft'),ftc,'https://search.ftc.gov/legal-library/browse/cases-proceedings/202-3141-microsoft-corporation-us-v',2023,'settlement','Xbox children’s registration data settlement',us,'USD 20 million','The FTC described a penalty and obligations related to children’s information collected for Xbox accounts.',['microsoft','xbox','children']),
  item(app('x'),ftc,'https://search.ftc.gov/legal-library/browse/cases-proceedings/2023062-twitter-inc-us-v',2022,'settlement','Twitter account security identifiers case',us,'USD 150 million','The settlement addressed allegations that phone numbers and email addresses collected for account security were also used for advertising.',['twitter','security','advertising']),
];
