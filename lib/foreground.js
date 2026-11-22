const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

class ForegroundWatcher {
  current(now = Date.now()) {
    if (process.platform !== 'win32' || this.closed) return null;
    if (this.child && now - this.observedAt > 8000) this.child.kill();
    if (!this.child && now >= (this.retryAt ?? 0)) this.start(now);
    return now - this.observedAt <= 2500 ? this.pid : null;
  }

  start(now) {
    try {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(__dirname, '..', 'scripts', 'foreground.ps1')], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, OUTBOUND_FOREGROUND_PARENT: String(process.pid) },
      });
      this.child = child;
      this.observedAt = now;
      this.pid = null;
      readline.createInterface({ input: child.stdout }).on('line', (line) => {
        if (!/^\d+$/.test(line)) return;
        this.pid = Number(line) || null;
        this.observedAt = Date.now();
      });
      child.on('error', () => { this.pid = null; });
      child.once('close', () => {
        this.child = null;
        this.pid = null;
        this.retryAt = Date.now() + 2000;
      });
    } catch {
      this.retryAt = now + 2000;
    }
  }

  close() {
    this.closed = true;
    this.child?.kill();
  }
}

module.exports = { ForegroundWatcher };
