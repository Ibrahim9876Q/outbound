param([Parameter(Mandatory)][string]$Collector)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$consent = 'Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore'

$required = @{ 'installed' = 'Get-AppxPackage'; 'scheduled tasks' = 'Get-ScheduledTask' }[$Collector]
if ($required) {
  try { Get-Command -Name $required -ErrorAction Stop | Out-Null }
  catch {
    [Console]::Error.WriteLine("Required Windows cmdlet is unavailable: $required")
    exit 69
  }
}

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

function StartupEntries {
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
}

function ScheduledTasks {
  Get-ScheduledTask -ErrorAction Stop | ForEach-Object {
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
}

function Services {
  $services = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Services')
  if (-not $services) { throw 'Service registry is unavailable.' }
  try {
    foreach ($service in Get-Service -ErrorAction Stop) {
      $entry = $services.OpenSubKey($service.Name)
      if (-not $entry) { continue }
      try {
        $description = $service.DisplayName + ' ' + $entry.GetValue('Description')
        if (($service.Name + ' ' + $description) -notmatch 'telemetry|diagtrack|dmwappushservice|diagnostics?|tracking') { continue }
        $start = $entry.GetValue('Start')
        $startType = switch ($start) { 0 { 'Boot' } 1 { 'System' } 2 { 'Automatic' } 3 { 'Manual' } 4 { 'Disabled' } }
        [pscustomobject]@{ kind='service'; name=$service.Name
          command=$entry.GetValue('ImagePath', $null, 'DoNotExpandEnvironmentNames'); description=$description
          status=[string]$service.Status; startType=$startType }
      } finally { $entry.Dispose() }
    }
  } finally {
    $services.Dispose()
  }
}

function PrivacyValue($Setting, $Choices) {
  foreach ($entry in $Choices) {
    $item = Get-ItemProperty -LiteralPath $entry[0] -Name $entry[1]
    $value = $item.($entry[1])
    if ($null -ne $value) { return [pscustomobject]@{ setting=$Setting; value=$value; mode=$entry[2] } }
  }
  [pscustomobject]@{ setting=$Setting; value=$null; mode=$null }
}

function PrivacyReadout {
  $pol = 'HKLM:\Software\Policies\Microsoft\Windows'
  $user = 'HKCU:\Software\Microsoft\Windows\CurrentVersion'
  $machine = 'HKLM:\Software\Microsoft\Windows\CurrentVersion'
  PrivacyValue 'Advertising ID' @(@("$pol\AdvertisingInfo",'DisabledByGroupPolicy','disabledPolicy'), @("$user\AdvertisingInfo",'Enabled','enabled'))
  PrivacyValue 'Diagnostic data' @(@("$pol\DataCollection",'AllowTelemetry','diagnostic'), @("$machine\Policies\DataCollection",'AllowTelemetry','diagnostic'))
  PrivacyValue 'Tailored experiences' @(@('HKCU:\Software\Policies\Microsoft\Windows\CloudContent','DisableTailoredExperiencesWithDiagnosticData','disabledPolicy'), @("$user\Privacy",'TailoredExperiencesWithDiagnosticDataEnabled','enabled'))
  PrivacyValue 'Activity history' @(@("$pol\System",'PublishUserActivities','enabled'), @("$pol\System",'EnableActivityFeed','enabled'), @("$user\ActivityHistory",'Enabled','enabled'))
  PrivacyValue 'Location service' @(@("$pol\LocationAndSensors",'DisableLocation','disabledPolicy'), @("HKLM:\$consent\location",'Value','consent'))
  PrivacyValue 'Inking and typing personalization' @(@("$pol\System",'AllowInputPersonalization','enabled'), @('HKCU:\Software\Microsoft\InputPersonalization','RestrictImplicitTextCollection','restriction'))
  PrivacyValue 'Find my device' @(@("$pol\FindMyDevice",'AllowFindMyDevice','enabled'), @('HKLM:\Software\Microsoft\Settings\FindMyDevice','LocationSyncEnabled','enabled'))
  PrivacyValue 'Online speech recognition' @(@("$pol\System",'AllowInputPersonalization','enabled'), @("$user\OnlineSpeechPrivacy",'HasAccepted','enabled'))
}

$rows = switch ($Collector) {
  'permissions' { ConsentEntries 'HKLM:'; ConsentEntries 'HKCU:' }
  'installed' { InstalledSoftware }
  'startup entries' { StartupEntries }
  'scheduled tasks' { ScheduledTasks }
  'services' { Services }
  'windowsPrivacy' { PrivacyReadout }
}
[Console]::WriteLine((ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress))
