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

function InstalledSoftware {
  foreach ($location in @(
    @{ Path='HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall'; Source='HKLM' },
    @{ Path='HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'; Source='HKLM-WOW6432Node' },
    @{ Path='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'; Source='HKCU' }
  )) {
    foreach ($entry in Get-ChildItem $location.Path) {
      $item = Get-ItemProperty $entry.PSPath
      if (-not $item.DisplayName) { continue }
      $size = if ($null -ne $item.EstimatedSize) { [long]$item.EstimatedSize * 1024 } else { $null }
      [pscustomobject]@{ name=$item.DisplayName; publisher=$item.Publisher; version=$item.DisplayVersion
        installDate=$item.InstallDate; sizeBytes=$size; source=$location.Source; icon=$item.DisplayIcon }
    }
  }
  Get-AppxPackage | ForEach-Object {
    [pscustomobject]@{ name=$_.Name; publisher=$_.Publisher; version=$_.Version.ToString()
      installDate=$null; sizeBytes=$null; source='Appx' }
  }
}

$rows = switch ($Collector) {
  'permissions' { ConsentEntries 'HKLM:'; ConsentEntries 'HKCU:' }
  'installed' { InstalledSoftware }
}
[Console]::WriteLine((ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress))
