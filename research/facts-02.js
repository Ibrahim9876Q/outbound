const discord = 'https://discord.com/privacy';
const slack = 'https://app.slack.com/trust/privacy/privacy-policy';
const transfer = (id, publisher, url, country, note, terms) =>
  ({ id, publisher, url, section: 'destinations', claim: { country, note }, terms });
module.exports = [
  transfer('discord','Discord',discord,'United States','Discord says it processes and stores information on servers in the United States.', ['discord','servers located in the united states','international data transfers']),
  transfer('slack','Slack',slack,'United States','Slack identifies the United States as a destination for possible personal-data transfers.', ['slack','including transfers to the united states','international data transfers']),
  ...['Australia','Canada','India','Japan','South Korea'].map((country) =>
    transfer('slack','Slack',slack,country,'Listed by Slack among possible transfer locations covered by its contractual safeguards.', ['slack','standard contractual clauses','australia, canada, india, japan, south korea'])),
  { id: 'discord', publisher: 'Discord', url: 'https://discord.com/privacy/policy/',
    section: 'sharesWith', terms: ['discord','service providers','cloud providers like google','host our data'],
    claim: { party: 'Cloud hosting providers such as Google', purpose: 'Host Discord data and services.' } },
  { id: 'Outlogic', company: true, aliases: ['X-Mode Social', 'X-Mode'], publisher: 'Federal Trade Commission',
    url: 'https://search.ftc.gov/news-events/news/press-releases/2024/01/ftc-order-prohibits-data-broker-x-mode-social-outlogic-selling-sensitive-location-data',
    section: 'incidents', terms: ['x-mode social','successor outlogic','sensitive location data','2024'],
    claim: { kind: 'settlement', title: 'X-Mode and Outlogic location-data action', year: 2024, jurisdiction: 'United States',
      summary: 'The FTC announced restrictions on sharing or selling sensitive location data to settle allegations involving location sales and inadequate safeguards.' } },
];
