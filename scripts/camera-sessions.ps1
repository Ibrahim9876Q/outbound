# Prints, once per second, which processes are streaming from any camera right now.
# Uses the Media Foundation sensor activity monitor (real-time), not the privacy registry log.
# Output: one JSON line per tick: {"at":<ms>,"sessions":[{"pid":123,"name":"Discord","camera":"USB2.0 HD UVC WebCam","active":true}]}
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

namespace OutboundCamera {
  [ComImport, Guid("d0cef145-b3f4-4340-a2e5-7a5080ca05cb"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMFSensorActivityMonitor { [PreserveSig] int Start(); [PreserveSig] int Stop(); }

  [ComImport, Guid("39dc7f4a-b141-4719-813c-a7f46162a2b8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMFSensorProcessActivity {
    [PreserveSig] int GetProcessId(out uint pid);
    [PreserveSig] int GetStreamingState(out bool streaming);
    [PreserveSig] int GetStreamingMode(out int mode);
    [PreserveSig] int GetReportTime(out long fileTime);
  }

  [ComImport, Guid("3e8c4be1-a8c2-4528-90de-2851bde5fead"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMFSensorActivityReport {
    [PreserveSig] int GetFriendlyName([MarshalAs(UnmanagedType.LPWStr)] StringBuilder name, uint size, out uint written);
    [PreserveSig] int GetSymbolicLink([MarshalAs(UnmanagedType.LPWStr)] StringBuilder link, uint size, out uint written);
    [PreserveSig] int GetProcessCount(out uint count);
    [PreserveSig] int GetProcessActivity(uint index, out IMFSensorProcessActivity activity);
  }

  [ComImport, Guid("683f7a5e-4a19-43cd-b1a9-dbf4ab3f7777"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMFSensorActivitiesReport {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetActivityReport(uint index, out IMFSensorActivityReport report);
  }

  [ComImport, Guid("de5072ee-dbe3-46dc-8a87-b6f631194751"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMFSensorActivitiesReportCallback {
    [PreserveSig] int OnActivitiesReport(IMFSensorActivitiesReport report);
  }

  public class CameraSession { public uint Pid; public string Camera; public bool Active; }

  [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
  public class Monitor : IMFSensorActivitiesReportCallback {
    [DllImport("mfplat.dll")] static extern int MFStartup(int version, int flags);
    [DllImport("mfsensorgroup.dll")] static extern int MFCreateSensorActivityMonitor(IMFSensorActivitiesReportCallback callback, out IMFSensorActivityMonitor monitor);

    static readonly object Gate = new object();
    static Dictionary<string, CameraSession> latest = new Dictionary<string, CameraSession>();
    static IMFSensorActivityMonitor monitor;
    static Monitor instance;

    public static int Begin() {
      MFStartup(0x00020070, 0);
      instance = new Monitor();
      int hr = MFCreateSensorActivityMonitor(instance, out monitor);
      if (hr != 0) return hr;
      return monitor.Start();
    }

    public int OnActivitiesReport(IMFSensorActivitiesReport report) {
      var next = new Dictionary<string, CameraSession>();
      uint count; report.GetCount(out count);
      for (uint i = 0; i < count; i++) {
        IMFSensorActivityReport device; if (report.GetActivityReport(i, out device) != 0) continue;
        var sb = new StringBuilder(512); uint written;
        device.GetFriendlyName(sb, 512, out written);
        uint procs; device.GetProcessCount(out procs);
        for (uint j = 0; j < procs; j++) {
          IMFSensorProcessActivity act; if (device.GetProcessActivity(j, out act) != 0) continue;
          uint pid; act.GetProcessId(out pid);
          bool streaming; act.GetStreamingState(out streaming);
          next[pid + "|" + sb] = new CameraSession { Pid = pid, Camera = sb.ToString(), Active = streaming };
        }
      }
      lock (Gate) { latest = next; }
      return 0;
    }

    public static List<CameraSession> Snapshot() {
      lock (Gate) { return new List<CameraSession>(latest.Values); }
    }
  }
}
'@

$hr = [OutboundCamera.Monitor]::Begin()
if ($hr -ne 0) { [Console]::Error.WriteLine("camera monitor failed to start: 0x{0:X8}" -f $hr); exit 1 }
$once = $args -contains '--once'
if ($once) { Start-Sleep -Milliseconds 1500 }
while ($true) {
  $sessions = foreach ($s in [OutboundCamera.Monitor]::Snapshot()) {
    $p = Get-Process -Id $s.Pid
    [pscustomobject]@{ pid = [int]$s.Pid; name = $p.ProcessName; path = $p.Path; camera = $s.Camera; active = [bool]$s.Active }
  }
  $line = [pscustomobject]@{ at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); sessions = @($sessions) } | ConvertTo-Json -Compress -Depth 4
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
  if ($once) { break }
  Start-Sleep -Milliseconds 1000
}
