const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { validAddress, validProgram } = require('../policy');

const execute = promisify(execFile);
const elevationScript = "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)";
const quote = (argument) => /\s/.test(argument) ? argument.replace(/=(.*)$/, '="$1"') : argument;

function build(rule, remove = false) {
  if (!/^[\da-f-]{36}$/i.test(rule.id) || rule.action !== 'block') return [];
  const { kind, value, addresses } = rule.target;
  let selectors = [];
  if (kind === 'app' && validProgram(rule.target.program || value)) {
    selectors = ['program=' + (rule.target.program || value)];
  } else if (kind === 'app' && Array.isArray(rule.target.programs)) {
    selectors = rule.target.programs.filter(validProgram).map((program) => 'program=' + program);
  } else if (kind === 'ip' && validAddress(value)) {
    selectors = ['remoteip=' + value];
  } else if (kind === 'company' && addresses?.length && addresses.every(validAddress)) {
    selectors = ['remoteip=' + addresses.join(',')];
  }
  return selectors.map((selector, i) => {
    const suffix = selectors.length > 1 ? '-' + (i + 1) : '';
    const args = ['advfirewall', 'firewall', remove ? 'delete' : 'add', 'rule',
      'name=Outbound-' + rule.id + suffix, 'dir=out'];
    if (!remove) args.push('action=block');
    args.push(selector);
    return { args, command: 'netsh ' + args.map(quote).join(' ') };
  });
}

function createWindowsEnforcer({ mode = process.env.OUTBOUND_ENFORCE, platform = process.platform,
  run = execute, elevated = async () => {
    const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', elevationScript], { windowsHide: true });
    return stdout.trim() === 'True';
  } } = {}) {
  return {
    name: 'windows-firewall',
    async plan(rule, { remove = false, preview = false } = {}) {
      const commands = build(rule, remove);
      if (!commands.length) {
        if (rule.action !== 'block') return [];
        const reason = {
          company: 'No addresses are observed yet for this company.',
          app: 'No readable running executable paths were found for this app.',
          domain: 'Windows Firewall cannot enforce DNS domain rules.',
        }[rule.target.kind];
        return reason ? [{ command: '', applied: false, reason }] : [];
      }
      let reason = null;
      if (preview || mode !== 'firewall') reason = 'Dry run. Outbound did not change firewall settings.';
      else if (rule.scope === 'session') reason = 'Session rules are not installed as persistent firewall rules.';
      else if (platform !== 'win32') reason = 'Windows Firewall is available only on Windows.';
      else if (!await elevated().catch(() => false)) reason = 'The process is not elevated.';
      else if (rule.approval?.status !== 'approved' || (remove && !rule.firewallApplied)) reason = 'There is no approved firewall change to apply.';
      const plan = [];
      for (const { command, args } of commands) {
        if (reason) { plan.push({ command, applied: false, reason }); continue; }
        try {
          await run('netsh.exe', args, { windowsHide: true, timeout: 10000 });
          plan.push({ command, applied: true, reason: 'Applied by Windows Firewall.' });
        } catch { plan.push({ command, applied: false, reason: 'Windows Firewall rejected the command.' }); }
      }
      return plan;
    },
  };
}

module.exports = { build, createWindowsEnforcer };
