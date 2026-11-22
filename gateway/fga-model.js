const fs = require('node:fs/promises');
const path = require('node:path');

const SOURCE = `model schema 1.1 type user type tracker relations define can_resolve: [user with unexpired] condition unexpired(current_time: timestamp, expires_at: timestamp) { current_time < expires_at }`;
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

async function publishModel(env, fetch = globalThis.fetch) {
  const required = ['FGA_API_URL', 'FGA_STORE_ID', 'FGA_CLIENT_ID', 'FGA_CLIENT_SECRET'];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error('Fill these values in the gitignored .env: ' + missing.join(', '));
  const api = env.FGA_API_URL.replace(/\/$/, '') + '/';
  if (!/^https:\/\/api\.[a-z0-9-]+\.fga\.dev\/$/.test(api) || !ID.test(env.FGA_STORE_ID)) {
    throw new Error('Set FGA_API_URL to your regional HTTPS FGA API and FGA_STORE_ID to a valid store ID.');
  }
  const source = await fs.readFile(path.join(__dirname, 'consent.fga'), 'utf8');
  if (source.trim().replace(/\s+/g, ' ') !== SOURCE) {
    throw new Error('consent.fga has changed. Update its JSON mapping in fga-model.js before publishing.');
  }
  const model = {
    schema_version: '1.1',
    type_definitions: [
      { type: 'user' },
      {
        type: 'tracker',
        relations: { can_resolve: { this: {} } },
        metadata: { relations: { can_resolve: { directly_related_user_types: [{ type: 'user', condition: 'unexpired' }] } } },
      },
    ],
    conditions: {
      unexpired: {
        name: 'unexpired',
        expression: 'current_time < expires_at',
        parameters: {
          current_time: { type_name: 'TYPE_NAME_TIMESTAMP' },
          expires_at: { type_name: 'TYPE_NAME_TIMESTAMP' },
        },
      },
    },
  };
  const options = () => ({ method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000) });
  const token = await fetch('https://fga.us1.auth0.com/oauth/token', {
    ...options(),
    body: new URLSearchParams({
      grant_type: 'client_credentials', audience: api,
      client_id: env.FGA_CLIENT_ID, client_secret: env.FGA_CLIENT_SECRET,
    }),
  });
  if (!token.ok) throw new Error('FGA token request returned HTTP ' + token.status + '.');
  const { access_token: accessToken } = await token.json();
  if (typeof accessToken !== 'string' || !accessToken) throw new Error('FGA returned no access token.');
  const response = await fetch(api + 'stores/' + env.FGA_STORE_ID + '/authorization-models', {
    ...options(),
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(model),
  });
  if (!response.ok) throw new Error('FGA model write returned HTTP ' + response.status + '. Check store client permissions.');
  const { authorization_model_id: id } = await response.json();
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('FGA returned no valid authorization model ID.');
  return id;
}

async function main() {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  console.log('FGA_MODEL_ID=' + await publishModel(process.env));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Could not publish FGA model. ' + error.message);
    process.exitCode = 1;
  });
}

module.exports = { publishModel };
