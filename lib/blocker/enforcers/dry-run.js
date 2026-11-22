const { createWindowsEnforcer } = require('./windows-firewall');

module.exports = { ...createWindowsEnforcer({ mode: 'dry-run' }), name: 'dry-run' };
