const assert = require('node:assert/strict');
const test = require('node:test');
const { refreshAutoruns } = require('./autoruns');

test('keeps retrying or failed autoruns stale while independently replacing successful sources', async () => {
  const previous = [{ kind: 'startup', name: 'Old startup' }, { kind: 'task', name: 'Old task' },
    { kind: 'service', name: 'Old service' }];
  const task = Promise.withResolvers();
  const update = Promise.withResolvers();
  const warnings = [];
  const next = [{ kind: 'startup', name: 'New startup' }];
  const done = refreshAutoruns(previous, (source) => {
    if (source === 'scheduled tasks') return task.promise;
    if (source === 'services') return [];
    return next;
  }, update.resolve, (warning) => warnings.push(warning));
  assert.deepEqual((await update.promise).map(({ name, stale }) => [name, stale]),
    [['New startup', false], ['Old task', true], ['Old service', true]]);
  task.reject(Object.assign(new Error('Cmdlet unavailable'), { code: 69 }));
  assert.deepEqual((await done).map(({ name, stale }) => [name, stale]),
    [['New startup', false], ['Old task', true]]);
  assert.deepEqual(warnings, ['Could not read scheduled tasks. A required Windows cmdlet is unavailable.']);
  assert.equal(previous[1].stale, undefined);
});
