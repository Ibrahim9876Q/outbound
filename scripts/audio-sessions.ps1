# Prints, once per second, which processes are capturing from any microphone right now.
# Uses Windows Core Audio session enumeration (real-time), not the privacy registry log.
# Output: one JSON line per tick: {"at":<ms>,"sessions":[{"pid":123,"name":"Discord","active":true}]}
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$parentProcess = $null
if ($env:OUTBOUND_DETECTOR_PARENT) {
  try {
    $parentProcess = [System.Diagnostics.Process]::GetProcessById([int]$env:OUTBOUND_DETECTOR_PARENT)
    # Acquire the process handle now so a reused PID cannot extend this worker's lifetime.
    $null = $parentProcess.Handle
  } catch { exit 0 }
}
Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace OutboundAudio {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo {}

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    int GetCount(out int count);
    int Item(int index, out IMMDevice device);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr sessionGuid, int flags, out IntPtr control);
    int GetSimpleAudioVolume(IntPtr sessionGuid, int flags, out IntPtr volume);
    int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
  }

  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator {
    int GetCount(out int count);
    int GetSession(int index, out IAudioSessionControl2 session);
  }

  [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    int GetState(out int state);
    int GetDisplayName(out IntPtr name);
    int SetDisplayName(string name, IntPtr ctx);
    int GetIconPath(out IntPtr path);
    int SetIconPath(string path, IntPtr ctx);
    int GetGroupingParam(out Guid param);
    int SetGroupingParam(ref Guid param, IntPtr ctx);
    int RegisterAudioSessionNotification(IntPtr client);
    int UnregisterAudioSessionNotification(IntPtr client);
    int GetSessionIdentifier(out IntPtr id);
    int GetSessionInstanceIdentifier(out IntPtr id);
    int GetProcessId(out uint pid);
    int IsSystemSoundsSession();
    int SetDuckingPreference(bool optOut);
  }

  public class CaptureSession { public uint Pid; public bool Active; }

  public static class Capture {
    public static List<CaptureSession> List() {
      var result = new List<CaptureSession>();
      var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorCo());
      IMMDeviceCollection devices;
      enumerator.EnumAudioEndpoints(1 /* eCapture */, 1 /* DEVICE_STATE_ACTIVE */, out devices);
      int count; devices.GetCount(out count);
      Guid iid = typeof(IAudioSessionManager2).GUID;
      for (int i = 0; i < count; i++) {
        IMMDevice device; devices.Item(i, out device);
        object o; device.Activate(ref iid, 23 /* CLSCTX_ALL */, IntPtr.Zero, out o);
        var manager = o as IAudioSessionManager2;
        if (manager == null) continue;
        IAudioSessionEnumerator sessions; manager.GetSessionEnumerator(out sessions);
        int n; sessions.GetCount(out n);
        for (int j = 0; j < n; j++) {
          IAudioSessionControl2 s; sessions.GetSession(j, out s);
          int state; s.GetState(out state);
          uint pid; s.GetProcessId(out pid);
          if (pid == 0) continue;
          result.Add(new CaptureSession { Pid = pid, Active = state == 1 });
        }
      }
      return result;
    }
  }
}
'@

$once = $args -contains '--once'
while ($null -eq $parentProcess -or -not $parentProcess.HasExited) {
  $byPid = @{}
  foreach ($s in [OutboundAudio.Capture]::List()) {
    if ($byPid.ContainsKey($s.Pid)) { $byPid[$s.Pid] = $byPid[$s.Pid] -or $s.Active } else { $byPid[$s.Pid] = $s.Active }
  }
  $sessions = foreach ($procId in $byPid.Keys) {
    $p = Get-Process -Id $procId
    [pscustomobject]@{ pid = [int]$procId; name = $p.ProcessName; path = $p.Path; active = [bool]$byPid[$procId] }
  }
  $line = [pscustomobject]@{ at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); sessions = @($sessions) } | ConvertTo-Json -Compress -Depth 4
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
  if ($once) { break }
  if ($null -eq $parentProcess) { Start-Sleep -Milliseconds 1000 }
  elseif ($parentProcess.WaitForExit(1000)) { break }
}
