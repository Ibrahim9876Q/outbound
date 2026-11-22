const fs = require('node:fs/promises');
const path = require('node:path');
const { researchLink } = require('../dossier');

async function json(file) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) return null;
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch { return null; }
}

async function dirs(root) {
  try { return (await fs.readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name); }
  catch { return []; }
}

function extensionRisk(permissions) {
  const names = new Set(permissions.map((permission) => permission.toLowerCase()));
  const allSites = [...names].some((permission) => permission === '<all_urls>' || /^(?:\*|https?):\/\/\*\/\*?$/.test(permission));
  return { allSites, risky: allSites || names.has('cookies') || names.has('history') ||
    names.has('tabs') && (names.has('webrequest') || names.has('webrequestblocking')) };
}

async function manifestName(manifest, root) {
  const name = typeof manifest.name === 'string' ? manifest.name : '';
  const token = name.match(/^__MSG_(.+)__$/i)?.[1];
  if (!token) return name;
  for (const locale of new Set([manifest.default_locale, 'en', 'en_US'])) {
    if (typeof locale !== 'string' || !/^[a-z0-9_-]+$/i.test(locale)) continue;
    const messages = await json(path.join(root, '_locales', locale, 'messages.json'));
    const match = Object.keys(messages ?? {}).find((key) => key.toLowerCase() === token.toLowerCase());
    if (typeof messages?.[match]?.message === 'string') return messages[match].message;
  }
  return name;
}

function row(profile, id, name, version, values, author, homepage) {
  const permissions = [...new Set(values.filter((value) => typeof value === 'string'))].sort();
  const publisher = typeof author === 'string' ? author.replace(/\s*<[^>]*>$/, '').trim() : '';
  const domain = typeof homepage === 'string' ? URL.parse(homepage)?.hostname : null;
  return { browser: profile.browser, profile: profile.profile, id, name: name || id,
    version: version ?? null, permissions, ...extensionRisk(permissions),
    ...(publisher ? { publisher } : {}), ...researchLink({ company: publisher, domain }) };
}

async function profileExtensions(profile) {
  if (profile.engine === 'firefox') {
    const index = await json(path.join(profile.root, 'extensions.json'));
    return (index?.addons ?? []).filter((entry) => entry.type === 'extension' && entry.id).map((entry) => {
      const permissions = entry.userPermissions ?? {};
      return row(profile, entry.id, entry.defaultLocale?.name, entry.version,
        [...(permissions.permissions ?? []), ...(permissions.origins ?? [])],
        entry.creator?.name ?? entry.defaultLocale?.creator, entry.homepageURL ?? entry.defaultLocale?.homepageURL);
    });
  }
  const extensions = path.join(profile.root, 'Extensions');
  const found = [];
  for (const id of await dirs(extensions)) {
    if (!/^[a-p]{32}$/.test(id)) continue;
    const versions = (await dirs(path.join(extensions, id))).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
    for (const version of versions) {
      const root = path.join(extensions, id, version);
      const manifest = await json(path.join(root, 'manifest.json'));
      if (!manifest) continue;
      found.push(row(profile, id, await manifestName(manifest, root), manifest.version,
        [...(manifest.permissions ?? []), ...(manifest.host_permissions ?? [])],
        manifest.author ?? manifest.developer?.name, manifest.homepage_url ?? manifest.developer?.url));
      break;
    }
  }
  return found;
}

module.exports = { profileExtensions, extensionRisk, manifestName };
