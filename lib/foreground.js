const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { detectorRetry } = require('./poll');

class ForegroundWatcher {
  current(now = Date.now()) {
    if (process.platform !== 'win32' || this.closed) return null;
    if (this.child && now - this.observedAt > 8000) {
      this.failure = { code: 'timeout' };
      this.child.kill();
    }
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
        this.failures = 0;
        this.failure = null;
        this.observedAt = Date.now();
      });
      child.on('error', (error) => { this.failure = error; });
      child.once('close', (code, signal) => {
        this.child = null;
        this.pid = null;
        this.retryAt = detectorRetry(this, 'foreground.ps1', this.failure ?? { code, signal });
      });
    } catch (error) {
      this.retryAt = detectorRetry(this, 'foreground.ps1', error);
    }
  }

  close() {
    this.closed = true;
    this.child?.kill();
  }
}

module.exports = { ForegroundWatcher };
