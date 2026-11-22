const { key, exeKey, findApp, findCompany } = require('./dossier');

const LIMITS = [
  ['trackerCompanies', 30, 8, 'Distinct tracker companies attributed to recent endpoints'],
  ['countries', 10, 8, 'Distinct countries estimated for recent endpoints'],
  ['backgroundConnections', 15, 30, 'New sockets observed while another app was foreground today'],
  ['sensitivePermissions', 15, 4, 'Distinct sensitive capabilities with recorded use'],
  ['riskyExtensions', 10, 8, 'Distinct extension IDs matching sensitive-permission rules'],
  ['autoruns', 10, 5, 'Matching startup, task or service records'],
  ['dossierIncidents', 10, 4, 'Distinct verified incidents in the app and publisher dossier'],
];

const SENSITIVE = new Set(['microphone', 'webcam', 'location', 'contacts', 'appointments', 'phonecall',
  'chat', 'email', 'documentslibrary', 'pictureslibrary', 'broadfilesystemaccess', 'graphicscaptureprogrammatic']);
const BROWSERS = { chrome: 'Chrome', msedge: 'Edge', brave: 'Brave', firefox: 'Firefox', opera: 'Opera' };

function calculateScore(raw) {
  const factors = LIMITS.map(([factor, weight, cap, description]) => {
    const value = Number.isFinite(raw[factor]) && raw[factor] >= 0 ? raw[factor] : null;
    return { factor, weight, raw: value, points: value === null ? null : Math.round(Math.min(value / cap, 1) * weight * 100) / 100,
      reason: value === null ? `${description}: unknown from the available data.` : `${description}: ${value} (full weight at ${cap}).` };
  });
  const known = factors.filter((factor) => factor.raw !== null);
  const coverage = known.reduce((total, factor) => total + factor.weight, 0);
  const sum = known.reduce((total, factor) => total + factor.points, 0);
  return { value: coverage ? Math.round(100 * sum / coverage) : null, coverage, factors };
}

function scoreApps(apps, scan, sampledAt) {
  const ready = scan.status === 'done';
  const matches = (app, name, exe) => Boolean(key(name) && key(name) === key(app.name) || exeKey(exe || name) === exeKey(app.id));
  const rows = apps.map((app) => {
    const destinations = app.destinations ?? [];
    const organizations = destinations.filter((d) => d.org && d.org !== 'Unknown owner');
    const countries = new Set(destinations.map((d) => d.country).filter(Boolean));
    const permissions = ready ? scan.permissions.filter((row) =>
      SENSITIVE.has(row.capability.toLowerCase()) && matches(app, row.app, row.exe)) : [];
    const browser = BROWSERS[exeKey(app.id)];
    const extensions = ready && browser ? scan.extensions.filter((row) => row.browser === browser) : [];
    const autoruns = ready ? scan.autoruns.filter((row) => {
      const command = /^(?:"([^"]+)"|(.+?\.exe)(?=\s|$))/i.exec(row.command ?? '');
      return matches(app, row.name, command?.[1] ?? command?.[2]);
    }) : [];
    const dossier = findApp(app.id, app.name);
    const publisher = findCompany(dossier?.publisher);
    const incidents = new Set([...(dossier?.incidents ?? []), ...(publisher?.incidents ?? [])]
      .filter((incident) => incident.source?.verified).map((incident) => `${key(incident.title)}|${incident.year}`));
    return { id: app.id, name: app.name, score: calculateScore({
      trackerCompanies: organizations.length ? new Set(organizations.filter((d) => d.tracker).map((d) => d.org)).size : null,
      countries: countries.size || null,
      backgroundConnections: app.background?.connections || null,
      sensitivePermissions: permissions.length ? new Set(permissions.filter((r) => r.lastUsedStart !== null).map((r) => r.capability)).size : null,
      riskyExtensions: extensions.length ? new Set(extensions.filter((r) => r.risky).map((r) => r.id)).size : null,
      autoruns: autoruns.length || null,
      dossierIncidents: dossier || publisher ? incidents.size : null,
    }) };
  });
  const overallRaw = Object.fromEntries(LIMITS.map(([factor], i) => {
    const values = rows.map(({ score }) => score.factors[i].raw).filter((value) => value !== null);
    return [factor, values.length ? Math.round(100 * values.reduce((s, n) => s + n, 0) / values.length) / 100 : null];
  }));
  const overall = calculateScore(overallRaw);
  overall.factors = overall.factors.map((factor) => ({ ...factor, reason: `Per-app observed mean. ${factor.reason}` }));
  return { sampledAt, overall, apps: rows };
}

module.exports = { calculateScore, scoreApps };
