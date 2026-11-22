$ErrorActionPreference = 'Stop'
$owner = [Diagnostics.Process]::GetProcessById([int]$env:OUTBOUND_FOREGROUND_PARENT)
$null = $owner.Handle
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OutboundForeground {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    public static uint ProcessId() {
        IntPtr window = GetForegroundWindow();
        uint pid = 0;
        if (window != IntPtr.Zero) GetWindowThreadProcessId(window, out pid);
        return pid;
    }
}
'@
while (-not $owner.HasExited) {
    [Console]::WriteLine([OutboundForeground]::ProcessId())
    if ($owner.WaitForExit(1000)) { break }
}
