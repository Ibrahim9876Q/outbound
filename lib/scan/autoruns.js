const sources = [
  ['startup', 'startup entries'],
  ['task', 'scheduled tasks'],
  ['service', 'services'],
];

const staleAutoruns = (previous) => previous.map((row) => ({ ...row, stale: true }));

async function refreshAutoruns(previous, collect, publish, warn) {
  const cached = staleAutoruns(previous);
  const groups = sources.map(([kind]) => cached.filter((row) => row.kind === kind));
  await Promise.all(sources.map(async ([kind, source], index) => {
    try {
      const rows = await collect(source);
      groups[index] = rows.filter((row) => row.kind === kind).map((row) => ({ ...row, stale: false }));
      publish(groups.flat());
    } catch {
      warn(`Could not read ${source}.`);
    }
  }));
  return groups.flat();
}

module.exports = { staleAutoruns, refreshAutoruns };
