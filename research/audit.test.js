const test = require('node:test');
const dossier = require('../public/data/research.json');
const { checkStructure, checkEvidence } = require('./audit');

test('dossier claims have unique sources and incident identities are distinct', () => checkStructure(dossier));
test('incident years and stated amounts match captured source evidence', () =>
  checkEvidence(dossier, require('./incident-evidence.json')));
