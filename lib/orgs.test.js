const assert = require('node:assert/strict');
const test = require('node:test');
const { isTrackerOrg, trackerCategory } = require('./orgs');

test('classifies all 16 tracker organizations observed in the weather.com run', () => {
  const ads = [
    'Rubicon', 'Outbrain', 'PubMatic', 'Criteo', 'AppNexus', 'Taboola', 'The Trade Desk',
    'Conversant', 'Pulsepoint', 'RTB Marketing and Tech Services', 'DeepIntent',
    'Adform A/S', 'Rocket Fuel', 'RhythmOne', 'Oath Holdings',
  ];
  for (const org of ads) {
    assert.equal(trackerCategory(org), 'ads', org);
    assert.equal(isTrackerOrg(org), true, org);
  }
  assert.equal(trackerCategory('Samba TV'), 'analytics');
  assert.equal(isTrackerOrg('Samba TV'), true);
});

test('normalizes ASN labels and preserves boundaries around brand names', () => {
  assert.equal(trackerCategory('AS1234: RTB-MARKETING & TECH SERVICES, LLC'), 'ads');
  assert.equal(trackerCategory('AS1234 SÁMBA-TV'), 'analytics');
  assert.equal(trackerCategory('AS1234 ORACLE_DATA_CLOUD'), 'data broker');
  assert.equal(trackerCategory('AS1234 SCORECARD-RESEARCH'), 'analytics');
  assert.equal(trackerCategory('Independent OpenXML Hosting'), null);
  assert.equal(isTrackerOrg(null), false);
});
