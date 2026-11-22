const fs = require('node:fs');

const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function readLocalJson(file, label, valid, warn = console.warn) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!valid(value)) throw new SyntaxError('Unexpected document shape');
    return value;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      const problem = error instanceof SyntaxError ? 'invalid JSON or an unexpected format' : 'a read error';
      warn(`Could not load ${label} (${problem}). Previous records are unavailable.`);
    }
    return null;
  }
}

module.exports = { isRecord, readLocalJson };
