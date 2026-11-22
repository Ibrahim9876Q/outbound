param([Parameter(Mandatory)][string]$Collector)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$consent = 'Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'

function ConsentEntries($Root) {
  foreach ($capability in Get-ChildItem "$Root\$consent") {
    foreach ($app in Get-ChildItem $capability.PSPath) {
      $keys = if ($app.PSChildName -eq 'NonPackaged') { Get-ChildItem $app.PSPath } else { $app }
      foreach ($key in $keys) {
        $props = Get-ItemProperty $key.PSPath
        if ($null -eq $props.Value -and $null -eq $props.LastUsedTimeStart -and $null -eq $props.LastUsedTimeStop) { continue }
        [pscustomobject]@{
          capability = $capability.PSChildName
          key = $key.PSChildName
          nonPackaged = $app.PSChildName -eq 'NonPackaged'
          permission = $props.Value
          start = [string]$props.LastUsedTimeStart
          stop = [string]$props.LastUsedTimeStop
        }
      }
    }
  }
}

$rows = switch ($Collector) {
  'permissions' { ConsentEntries 'HKLM:'; ConsentEntries 'HKCU:' }
}
[Console]::WriteLine((ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress))
