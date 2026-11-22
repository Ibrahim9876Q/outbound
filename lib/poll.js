const { execFile } = require('node:child_process');
const { setTimeout: wait } = require('node:timers/promises');

const reported = new Map();
function warnPoll(name, error) {
  const code = error?.code || error?.signal || error?.name || 'failed';
  const key = `${name}|${code}`;
  const now = Date.now();
  if (now - (reported.get(key) ?? -Infinity) < 60000) return;
  reported.set(key, now);
  console.warn(`[poll] ${name}: ${code}; preserving previous observations where available`);
}

async function runPoll(name, command, args, { input, timeout = 5000, maxBuffer = 16 * 1024 * 1024, parse = (text) => text } = {}) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const output = await new Promise((resolve, reject) => {
        const child = execFile(command, args, { windowsHide: true, timeout, maxBuffer },
          (error, text) => error ? reject(error) : resolve(text));
        if (input !== undefined) {
          child.stdin.on('error', () => {});
          child.stdin.end(input);
        }
      });
      return parse(output);
    } catch (error) {
      failure = error;
      if (attempt === 0) await wait(350);
    }
  }
  warnPoll(name, failure);
  const error = new Error(name);
  error.code = failure?.code || failure?.signal || failure?.name;
  error.reported = true;
  throw error;
}

function detectorRetry(detector, label, error) {
  detector.failures = (detector.failures ?? 0) + 1;
  if (detector.failures > 1) warnPoll(label, error);
  return Date.now() + (detector.failures === 1 ? 2000 : 30000);
}

module.exports = { runPoll, warnPoll, detectorRetry };
