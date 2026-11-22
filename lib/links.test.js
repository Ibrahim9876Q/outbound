const assert = require('node:assert/strict');
const test = require('node:test');
const { buildLinks } = require('./links');

test('builds observed TCP, parent and UDP edges and labels inferred pipes and shared hubs', () => {
  const apps = [
    { id: 'chrome.exe', name: 'Chrome', destinations: [{ org: 'Example Ads', tracker: true }] },
    { id: 'discord.exe', name: 'Discord', destinations: [{ org: 'Example Ads', tracker: true }] },
  ];
  const fixture = {
    processes: [
      { ProcessId: 1, ParentProcessId: 0, Name: 'chrome.exe' },
      { ProcessId: 2, ParentProcessId: 1, Name: 'discord.exe' },
    ],
    tcp: [
      { OwningProcess: 1, LocalAddress: '127.0.0.1', LocalPort: 9000, RemoteAddress: '127.0.0.1', RemotePort: 50000 },
      { OwningProcess: 2, LocalAddress: '::ffff:127.0.0.1', LocalPort: 50000, RemoteAddress: '::ffff:127.0.0.1', RemotePort: 9000 },
      { OwningProcess: 2, LocalAddress: '::1', LocalPort: 50000, RemoteAddress: '::1', RemotePort: 9000 },
    ],
    udp: [{ OwningProcess: 2, LocalAddress: '::', LocalPort: 5353 }],
    pipes: ['chrome-discord-ipc', 'unrelated'],
  };
  const { edges, nodes } = buildLinks(apps, fixture, new Map(), 100);
  const links = [...edges.values()];
  assert.equal(links.filter((link) => link.kind === 'loopback').length, 1);
  assert.equal(links.find((link) => link.kind === 'pipe').confidence, 'inferred');
  assert.equal(links.find((link) => link.kind === 'udp').from, 'Discord');
  assert.equal(links.filter((link) => link.kind === 'shared-company' && link.to === 'company:Example Ads').length, 2);
  assert.equal(links.filter((link) => link.kind === 'shared-tracker' && link.to === 'company:Example Ads').length, 2);
  assert.deepEqual(nodes.get('chrome.exe').children, ['Discord']);
  assert.deepEqual(nodes.get('discord.exe').udp, [{ localPort: 5353, localAddress: '::' }]);
  assert([...buildLinks(apps, fixture, edges, 200).edges.values()].every((link) => link.since === 100));
});
