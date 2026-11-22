module.exports = {
  name: 'local',
  configured: true,
  async approve() { return { status: 'approved', via: 'local' }; },
  async check() { return true; },
};
