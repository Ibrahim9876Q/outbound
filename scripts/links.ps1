$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$tcp = @(Get-NetTCPConnection |
  Where-Object { $_.State -eq 'Established' -and $_.LocalAddress -match '^(127\.|::1$|::ffff:127\.)' -and $_.RemoteAddress -match '^(127\.|::1$|::ffff:127\.)' } |
  Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess)
$processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name)
$udp = @(Get-NetUDPEndpoint | Select-Object LocalAddress, LocalPort, OwningProcess)
$pipes = @()
try { $pipes = @([System.IO.Directory]::GetFiles('\\.\pipe\') | ForEach-Object { [IO.Path]::GetFileName($_) }) } catch {}
[Console]::WriteLine((@{ tcp = $tcp; processes = $processes; udp = $udp; pipes = $pipes } | ConvertTo-Json -Depth 4 -Compress))
