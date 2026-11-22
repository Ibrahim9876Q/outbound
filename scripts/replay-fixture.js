if (!process.env.OUTBOUND_FIXTURE?.trim()) {
  console.error('Set OUTBOUND_FIXTURE to a local /api/state recording to start replay.');
  process.exitCode = 1;
} else {
  require('../server');
}
