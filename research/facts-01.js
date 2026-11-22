const openai = 'https://openai.com/policies/privacy-policy/';
const google = 'https://policies.google.com/privacy?hl=en-US';
module.exports = [
  { id: 'chatgpt', publisher: 'OpenAI', url: openai,
    terms: ['openai','vendors, service providers','hosting services','business operations'],
    section: 'sharesWith', claim: { party: 'Vendors and service providers', purpose: 'Hosting, support and other functions needed to operate the service.' } },
  { id: 'chatgpt', publisher: 'OpenAI', url: openai,
    terms: ['openai','united states','various jurisdictions'],
    section: 'destinations', claim: { country: 'United States', note: 'The policy identifies the United States among jurisdictions where personal data may be processed.' } },
  { id: 'youtube', publisher: 'Google', url: google,
    terms: ['google','youtube','external processing','affiliates'],
    section: 'sharesWith', claim: { party: 'Google affiliates and trusted processors', purpose: 'Process information on Google’s behalf under its instructions.' } },
  { id: 'snapchat', publisher: 'Snap', url: 'https://values.snap.com/privacy/privacy-policy',
    terms: ['snapchat','united states','transfer'],
    section: 'destinations', claim: { country: 'United States', note: 'Snap identifies the United States as a possible country for international data transfers.' } },
  { id: 'spotify', publisher: 'Spotify', url: 'https://www.spotify.com/us/legal/privacy-policy/',
    terms: ['spotify','service providers','technical infrastructure'],
    section: 'sharesWith', claim: { party: 'Service providers', purpose: 'Help run Spotify, including its technical infrastructure.' } },
  { id: 'signal', publisher: 'Signal', url: 'https://signal.org/legal/',
    terms: ['signal','third-party providers','verification code'],
    section: 'sharesWith', claim: { party: 'Registration verification providers', purpose: 'Send the phone verification code during account registration.' } },
];
