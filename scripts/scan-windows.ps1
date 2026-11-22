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

function Autoruns {
  foreach ($root in @('HKCU:\Software\Microsoft\Windows\CurrentVersion', 'HKLM:\Software\Microsoft\Windows\CurrentVersion',
      'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion')) {
    foreach ($key in @('Run', 'RunOnce')) {
      $registry = Get-Item "$root\$key"
      if (-not $registry) { continue }
      foreach ($name in $registry.GetValueNames()) {
        $command = $registry.GetValue($name, $null, 'DoNotExpandEnvironmentNames')
        if ($command -is [string]) { [pscustomobject]@{ kind='startup'; name=$name; command=$command } }
      }
    }
  }
  $shell = New-Object -ComObject WScript.Shell
  foreach ($folder in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup')) | Select-Object -Unique) {
    if (-not $folder) { continue }
    foreach ($file in Get-ChildItem -LiteralPath $folder -File) {
      if ($file.Name -eq 'desktop.ini') { continue }
      $command = $file.FullName
      if ($shell -and $file.Extension -eq '.lnk') {
        $shortcut = $shell.CreateShortcut($file.FullName)
        if ($shortcut.TargetPath) { $command = ('"{0}" {1}' -f $shortcut.TargetPath, $shortcut.Arguments).Trim() }
      }
      [pscustomobject]@{ kind='startup'; name=$file.BaseName; command=$command }
    }
  }
  Get-ScheduledTask | ForEach-Object {
    $commands = @($_.Actions | ForEach-Object {
      if ($_.Execute) { ('"{0}" {1}' -f $_.Execute, $_.Arguments).Trim() }
      elseif ($_.ClassId) { 'COM handler ' + $_.ClassId }
    })
    $triggers = @($_.Triggers | ForEach-Object {
      @{ type=$_.CimClass.CimClassName; enabled=$_.Enabled; start=$_.StartBoundary; end=$_.EndBoundary;
         repetition=$_.Repetition.Interval; daysInterval=$_.DaysInterval; daysOfWeek=$_.DaysOfWeek; weeksInterval=$_.WeeksInterval;
         delay=$_.Delay }
    })
    [pscustomobject]@{ kind='task'; name=($_.TaskPath + $_.TaskName); command=($commands -join ' ; ')
      publisher=$_.Author; status=[string]$_.State; triggers=$triggers }
  }
  Get-CimInstance Win32_Service | ForEach-Object {
    [pscustomobject]@{ kind='service'; name=$_.Name; command=$_.PathName; description=($_.DisplayName + ' ' + $_.Description)
      status=$_.State; startType=$_.StartMode }
  }
}

$rows = switch ($Collector) {
  'permissions' { ConsentEntries 'HKLM:'; ConsentEntries 'HKCU:' }
  'installed' { InstalledSoftware }
  'autoruns' { Autoruns }
}
[Console]::WriteLine((ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress))
