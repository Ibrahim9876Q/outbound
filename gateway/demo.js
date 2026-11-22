const { Resolver } = require('node:dns/promises');

const DOMAIN = 'google-analytics.com';

async function lookupTracker(port) {
  const resolver = new Resolver({ tries: 1, timeout: 5000 });
  resolver.setServers(['127.0.0.1:' + port]);
  try {
    await resolver.resolve4(DOMAIN);
    return 'Lookup allowed.';
  } catch (error) {
    if (error.code === 'EREFUSED') return 'Lookup blocked.';
    throw error;
  }
}

function createDemo() {
  const grants = new Map();
  let pending;
  return {
    fga: {
      async check(domain) { return grants.get(domain) > Date.now(); },
      async grant(domain, expiry) { grants.set(domain, expiry); },
      async revoke(domain) { grants.delete(domain); },
      async list() { return new Map(grants); },
    },
    ciba: {
      async start() { return { deadline: Date.now() + 120000 }; },
      waitForDecision({ deadline }) {
        return new Promise((resolve) => {
          const timer = setTimeout(() => pending('expired'), deadline - Date.now());
          timer.unref();
          pending = (result) => {
            clearTimeout(timer);
            pending = undefined;
            resolve(result);
          };
        });
      },
    },
    decide(result) {
      if (!pending) return false;
      pending(result);
      return true;
    },
    async resolve(packet, question) {
      const response = Buffer.from(packet.subarray(0, question.end));
      const hasAnswer = question.host === DOMAIN && question.type === 1;
      response.writeUInt16BE(0x8180, 2);
      response.writeUInt16BE(hasAnswer ? 1 : 0, 6);
      response.writeUInt16BE(0, 10);
      // RFC 5737 documentation address. This fixture never contacts a resolver.
      const record = Buffer.from('c00c000100010000003c0004c0000201', 'hex');
      return {
        response: hasAnswer ? Buffer.concat([response, record]) : response,
        answer: { ...question, flags: 0x8180 },
      };
    },
  };
}

module.exports = { createDemo, lookupTracker };
