const fs = require('node:fs/promises');
const path = require('node:path');

const LARGE = 50 * 1024 * 1024;

function blank() {
  return { bytes: 0, files: 0, kinds: { cache: 0, cookies: 0, logs: 0, databases: 0, other: 0 }, lastWrite: null };
}

function kind(name, parentKind) {
  const value = name.toLowerCase();
  if (/cookie/.test(value)) return 'cookies';
  if (/^leveldb$|\.(?:db|sqlite\d*|ldb)(?:-wal|-shm)?$/.test(value)) return 'databases';
  if (/^logs?$|\.log(?:\.\d+)?$/.test(value)) return 'logs';
  if (/cache/.test(value)) return 'cache';
  return parentKind;
}

function merge(total, child) {
  total.bytes += child.bytes;
  total.files += child.files;
  for (const key of Object.keys(total.kinds)) total.kinds[key] += child.kinds[key];
  if (child.lastWrite !== null) total.lastWrite = Math.max(total.lastWrite ?? 0, child.lastWrite);
}

function comparable(value) { return value.toLowerCase().replace(/\.exe$/i, '').replace(/[^a-z0-9]+/g, ''); }

function owner(apps, name) {
  const folder = comparable(name);
  return apps.find(({ id, name }) => [comparable(id), comparable(name)].some((key) =>
    key.length >= 3 && (folder === key || folder.startsWith(key) || folder.includes(key) && key.length >= 6)));
}

async function entries(folder) {
  try { return await fs.readdir(folder, { withFileTypes: true }); }
  catch { return []; }
}

async function scanAppData(apps, onProgress, env = process.env, budgetMs = 20000, onPartial = null) {
  const start = Date.now();
  const deadline = onPartial ? Infinity : start + budgetMs;
  const results = [];
  const active = new Set();
  const sorted = (rows) => rows.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  const timer = onPartial && setTimeout(() => {
    onPartial(sorted([...results, ...[...active].flatMap((job) => rowsFor(job, true))]));
  }, budgetMs);
  try {
    return await collect();
  } finally {
    clearTimeout(timer);
  }

  function rowsFor({ candidate, total, children }, partial) {
    const rows = [];
    const parentTotal = blank();
    merge(parentTotal, total);
    for (const child of children.values()) {
      if (child.total.files && (child.app || child.total.bytes > LARGE)) {
        rows.push({ app: child.app?.name ?? child.directory, path: child.path, ...child.total,
          kinds: { ...child.total.kinds }, partial: partial && !child.complete });
      } else {
        merge(parentTotal, child.total);
      }
    }
    if (parentTotal.files && (candidate.app || parentTotal.bytes > LARGE)) {
      rows.push({ app: candidate.app?.name ?? candidate.directory, path: candidate.path, ...parentTotal, partial });
    }
    return rows;
  }

  async function collect() {
  const roots = [...new Set([env.LOCALAPPDATA, env.APPDATA, env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Packages')].filter(Boolean))];
  const candidates = [];
  for (const root of roots) {
    for (const entry of await entries(root)) {
      if (Date.now() >= deadline) break;
      const folder = path.join(root, entry.name);
      if (!entry.isDirectory() || roots.includes(folder)) continue;
      const app = owner(apps, entry.name);
      const children = app ? [] : (await entries(folder)).filter((child) => child.isDirectory())
        .map((child) => ({ path: path.join(folder, child.name), directory: child.name, app: owner(apps, child.name) }));
      candidates.push({ path: folder, directory: entry.name, app, children });
    }
  }
  const known = (candidate) => Boolean(candidate.app || candidate.children.some((child) => child.app));
  candidates.sort((a, b) => Number(known(b)) - Number(known(a)));
  let next = 0;
  let finished = 0;
  let lastProgress = 0;
  function progress() {
    const now = Date.now();
    if (now - lastProgress < 250) return;
    lastProgress = now;
    onProgress(Math.min(1, Math.max(finished / Math.max(1, candidates.length), (now - start) / budgetMs)));
  }

  async function walk(folder, total, category, children) {
    if (Date.now() >= deadline) return;
    let dir;
    try { dir = await fs.opendir(folder); } catch { return; }
    for await (const entry of dir) {
      if (Date.now() >= deadline) break;
      const file = path.join(folder, entry.name);
      const child = children?.get(file);
      const fileKind = kind(entry.name, category);
      if (entry.isDirectory()) {
        await walk(file, child?.total ?? total, fileKind);
        if (child) child.complete = Date.now() < deadline;
      } else if (entry.isFile()) {
        let stat;
        try { stat = await fs.lstat(file); } catch { continue; }
        if (!stat.isFile()) continue;
        total.bytes += stat.size;
        total.files++;
        total.kinds[fileKind]++;
        total.lastWrite = Math.max(total.lastWrite ?? 0, stat.mtimeMs);
      }
      progress();
    }
  }

  async function consume() {
    while (next < candidates.length && Date.now() < deadline) {
      const candidate = candidates[next++];
      const total = blank();
      const children = new Map(candidate.children.map((child) => [child.path, { ...child, total: blank() }]));
      const job = { candidate, total, children };
      active.add(job);
      await walk(candidate.path, total, kind(candidate.directory, 'other'), children);
      results.push(...rowsFor(job, Date.now() >= deadline));
      active.delete(job);
      finished++;
      progress();
    }
  }
  await Promise.all(Array.from({ length: 6 }, consume));
  return { apps: sorted(results),
    appDataTimedOut: Date.now() >= deadline };
  }
}

module.exports = { scanAppData };
