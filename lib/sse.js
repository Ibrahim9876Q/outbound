function frame(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

class StateStream {
  constructor(snapshot) {
    this.snapshot = snapshot;
    this.clients = new Map();
    this.pending = [];
  }

  connect(res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    this.clients.set(res, Date.now());
    res.once('close', () => this.clients.delete(res));
    res.write(frame('state', this.snapshot()));
  }

  event(event) {
    if (!this.clients.size) return;
    this.pending.push(event);
    if (this.pending.length > 40) this.pending.shift();
  }

  flush(now = Date.now()) {
    const events = this.pending.splice(0);
    if (!this.clients.size) return;
    const batch = events.map((event) => frame('event', event)).join('') + frame('state', this.snapshot());
    for (const [res, lastHeartbeat] of this.clients) {
      if (res.writableNeedDrain) continue;
      if (now - lastHeartbeat >= 15000) {
        this.clients.set(res, now);
        res.write(`: heartbeat\n\n${batch}`);
      } else {
        res.write(batch);
      }
    }
  }
}

module.exports = { StateStream };
