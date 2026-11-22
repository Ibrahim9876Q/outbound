const transfer = (id, country, url, note, terms) => ({
  id, company:true, publisher:id, url, section:'destinations', terms, claim:{country,note},
});
module.exports = [
  transfer('Microsoft','United States','https://privacy.microsoft.com/en-us/privacystatement','Microsoft names the United States as a possible location for storing and processing personal data.',['microsoft','where we store and process personal data','united states']),
  transfer('Google','United States','https://policies.google.com/privacy/frameworks?hl=en-US','Google describes protections for personal information transferred from the EEA, UK, and Switzerland to the United States.',['google','united states','data privacy framework']),
  transfer('Adobe','United States','https://www.adobe.com/privacy/policy.html','Adobe identifies its US operations and describes transfers of personal information across borders.',['adobe','united states','transfer','personal information']),
  transfer('Salesforce','United States','https://www.salesforce.com/company/privacy/','Salesforce identifies the United States among countries where personal data may be processed.',['salesforce','international transfer','united states']),
  transfer('AppsFlyer','United States','https://www.appsflyer.com/legal/services-privacy-policy/','AppsFlyer names the United States in its international data transfer disclosures.',['appsflyer','united states','transfer']),
  transfer('Yandex','Russia','https://yandex.com/legal/confidential/','Yandex’s notice describes processing in Russia and possible international transfers.',['yandex','russia','transfer']),
];
