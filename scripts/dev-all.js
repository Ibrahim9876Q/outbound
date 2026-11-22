const { spawn } = require('node:child_process');
const path = require('node:path');

if (Object.hasOwn(process.env, 'OUTBOUND_FIXTURE')) {
  console.error('Use npm run fixture for desktop-only replay. Clear OUTBOUND_FIXTURE to run the live servers.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const children = new Set();
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.connected) child.disconnect();
  }
}

for (const entry of ['server.js', 'gateway/server.js']) {
  const child = spawn(process.execPath, [entry], {
    cwd: root, stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: entry === 'server.js' ? { ...process.env, OUTBOUND_PHONE: '1',
      PHONE_URL: process.env.PHONE_URL || `http://127.0.0.1:${process.env.PHONE_DASHBOARD_PORT || 4320}` } : process.env,
  });
  children.add(child);
  child.once('error', (error) => {
    console.error(`${entry}: ${error.message}`);
    children.delete(child);
    stop(1);
  });
  child.once('exit', (code) => {
    children.delete(child);
    stop(code ?? 1);
  });
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
