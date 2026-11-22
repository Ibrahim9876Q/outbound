const ny = 'https://ag.ny.gov/press-release/';
const ftc = 'https://search.ftc.gov/legal-library/browse/cases-proceedings/';
const rows = [
  ['Refuah Health Center','Refuah ransomware safeguards agreement',2024,'New York Attorney General',ny+'2024/attorney-general-james-reaches-agreement-hudson-valley-health-care-provider','Refuah','ransomware attack','The state reported safeguards deficiencies and reached an agreement requiring investment in patient-data security.'],
  ['HealthAlliance','HealthAlliance patient-data agreement',2024,'New York Attorney General',ny+'2024/attorney-general-james-secures-550000-hudson-valley-health-care-facility','HealthAlliance','$550,000','New York announced penalties and security requirements following an investigation of patient data protection.'],
  ['Albany ENT & Allergy Services','Albany ENT patient-data agreement',2024,'New York Attorney General',ny+'2024/attorney-general-james-secures-225-million-capital-region-health-care-provider','Albany ENT','cyberattacks','An agreement required penalties and security investment after attacks compromised patient records.'],
  ['OrthopedicsNY','OrthopedicsNY privacy settlement',2025,'New York Attorney General',ny+'2025/attorney-general-james-secures-500000-capital-region-health-care-provider','OrthopedicsNY','$500,000','The state announced a settlement over safeguards after attackers obtained patient data.'],
  ['NewYork-Presbyterian','Hospital tracking technology agreement',2023,'New York Attorney General',ny+'2023/attorney-general-james-secures-300000-newyork-presbyterian-hospital-failing','NewYork-Presbyterian','tracking','New York announced an agreement involving tracking technology on hospital websites.'],
  ['U.S. Radiology','U.S. Radiology data security agreement',2023,'New York Attorney General',ny+'2023/attorney-general-james-secures-450000-medical-company-providing-services-western','U.S. Radiology','patient data','The state announced a settlement over security failures affecting patient data.'],
  ['Enzo Biochem','Enzo Biochem ransomware settlement',2024,'New York Attorney General',ny+'2024/attorney-general-james-secures-45-million-biotech-company-failing-protect-new','Enzo Biochem','ransomware','State attorneys general investigated safeguards after a ransomware attack on a clinical laboratory business.'],
  ['Personal Touch','Personal Touch patient and employee data settlement',2023,'New York Attorney General',ny+'2023/attorney-general-james-secures-350000-long-island-home-health-care-company','Personal Touch','employee data','The state reached an agreement over safeguards for patient and employee data.'],
  ['Blackbaud','Multistate Blackbaud breach settlement',2023,'New York Attorney General',ny+'2023/attorney-general-james-and-multistate-coalition-secure-495-million-cloud-company','Blackbaud','$49.5 million','A coalition of state attorneys general settled a matter over a breach at the cloud software provider.'],
  ['Healthline','Healthline CCPA settlement',2025,'California Attorney General','https://www.oag.ca.gov/news/press-releases/attorney-general-bonta-announces-largest-ccpa-settlement-date-secures-155','Healthline','$1.55 million','California announced a settlement over advertising disclosures and consumer opt-out practices.'],
  ['Honda','Honda California privacy settlement',2025,'California Privacy Protection Agency','https://cppa.ca.gov/announcements/2025/20250312.html','Honda','opt-out','Honda agreed to change privacy request and consent practices under a California administrative settlement.'],
  ['Cognosphere','Genshin Impact children’s privacy and marketing matter',2025,'Federal Trade Commission',ftc+'222-3152-cognosphere-llc-us-v','Cognosphere','children','The FTC case includes allegations involving children’s information in Genshin Impact.'],
  ['NGL','NGL youth safety and privacy order',2024,'Federal Trade Commission',ftc+'ngl','NGL','children','The FTC case addressed youth privacy and other claims related to the NGL messaging app.'],
  ['Disney','Disney children’s video privacy matter',2025,'Federal Trade Commission',ftc+'disney','Disney','COPPA','The FTC alleged that Disney failed to properly designate some child-directed YouTube videos.'],
  ['Easy Healthcare','Premom federal stipulated order',2023,'Federal Trade Commission','https://search.ftc.gov/system/files/ftc_gov/pdf/2023.06.22_easy_healthcare_signed_order_2023.pdf','Easy Healthcare','Premom','A federal court entered an order related to the Premom fertility app and its handling of health information.'],
  ['Cerebral','Cerebral telehealth information complaint',2024,'Federal Trade Commission',ftc+'222-3067-cerebral-inc-kyle-robertson-us-v','Cerebral','sensitive','The FTC case alleged improper use or disclosure of sensitive data from users of the telehealth service.'],
];
module.exports = rows.map(([id, title, year, publisher, url, entity, evidence, summary]) => ({
  id, company: true, publisher, url, section: 'incidents', creation: [id],
  terms: [entity, String(year), evidence], claim: {
    title, year, summary, jurisdiction: 'United States', kind: publisher.includes('Attorney General') ? 'settlement' : 'regulator',
  },
}));
