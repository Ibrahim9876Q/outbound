const { orgForHost, isTracker, trackerCategory } = require('../orgs');
const { registrableDomain } = require('./domains');

function lookup(map, key) { return map && Object.hasOwn(map, key) ? map[key] : undefined; }

function suffixLookup(map, domain) {
  for (let candidate = domain; candidate.includes('.'); candidate = candidate.slice(candidate.indexOf('.') + 1)) {
    const result = lookup(map, candidate);
    if (result) return result;
  }
}

function mapTrackers(browsers, dataset) {
  const sites = new Set(), trackedSites = new Set(), cookieDomains = new Set(), trackerCookieDomains = new Set();
  const companies = new Map();
  for (const browser of browsers) {
    for (const site of browser.sites) {
      sites.add(site.domain);
      const company = lookup(dataset.owners, site.domain) || orgForHost(site.domain);
      if (company) site.company = company;
      site.trackers = (lookup(dataset.sites, site.domain) ?? []).map((id) => lookup(dataset.trackers, id)).filter(Boolean);
      if (site.trackers.length) trackedSites.add(site.domain);
      for (const tracker of site.trackers) {
        if (!companies.has(tracker.company)) companies.set(tracker.company, new Set());
        companies.get(tracker.company).add(site.domain);
      }
    }
    for (const cookie of browser.cookieDomains) {
      cookieDomains.add(cookie.domain);
      const pattern = lookup(dataset.trackers, suffixLookup(dataset.domains, cookie.domain));
      const company = pattern?.company || orgForHost(cookie.domain) || lookup(dataset.owners, registrableDomain(cookie.domain));
      const category = pattern?.category ?? trackerCategory(company) ?? trackerCategory(cookie.domain.replace(/\.[^.]+$/, ''));
      cookie.isTracker = Boolean(pattern || category || isTracker(cookie.domain));
      if (company) cookie.company = company;
      if (category) cookie.category = category;
      if (cookie.isTracker) trackerCookieDomains.add(cookie.domain);
    }
  }
  const topTrackers = [...companies].map(([company, sites]) => ({ company, sites: sites.size }))
    .sort((a, b) => b.sites - a.sites || a.company.localeCompare(b.company)).slice(0, 20);
  return { sitesVisited: sites.size, sitesWithTrackers: trackedSites.size, trackerCompanies: companies.size,
    cookieDomains: cookieDomains.size, trackerCookieDomains: trackerCookieDomains.size, topTrackers };
}

module.exports = { mapTrackers };
