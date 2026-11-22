const LIMITS = {
  apps: 80, destinations: 40, links: 160, legacyLinks: 160, events: 24,
  localPeers: 24, udp: 20, children: 24, backgroundNames: 24,
  lastUsedByApp: 10, recentSessions: 10,
};

function limitSnapshot(state) {
  const apps = state.apps.slice(0, LIMITS.apps).map((app) => ({
    ...app,
    destinations: app.destinations.slice(0, LIMITS.destinations),
    localPeers: app.localPeers.slice(0, LIMITS.localPeers),
    udp: app.udp.slice(0, LIMITS.udp),
    children: app.children.slice(0, LIMITS.children),
    background: { ...app.background, companies: app.background.companies.slice(0, LIMITS.backgroundNames),
      trackers: app.background.trackers.slice(0, LIMITS.backgroundNames) },
    totals: { destinations: app.destinations.length, localPeers: app.localPeers.length, udp: app.udp.length,
      children: app.children.length, backgroundCompanies: app.background.companies.length,
      backgroundTrackers: app.background.trackers.length },
  }));
  const devices = { ...state.devices };
  for (const kind of ['mic', 'camera']) {
    const device = state.devices[kind];
    devices[kind] = { ...device, recentSessions: device.recentSessions.slice(0, LIMITS.recentSessions),
      lastUsedByApp: device.lastUsedByApp.slice(0, LIMITS.lastUsedByApp),
      totals: { recentSessions: device.recentSessions.length, lastUsedByApp: device.lastUsedByApp.length } };
  }
  return { ...state, apps, devices, links: state.links.slice(0, LIMITS.links),
    legacyLinks: state.legacyLinks.slice(0, LIMITS.legacyLinks), events: state.events.slice(0, LIMITS.events),
    totals: { apps: state.apps.length, links: state.links.length, legacyLinks: state.legacyLinks.length, events: state.events.length } };
}

module.exports = { limitSnapshot, LIMITS };
