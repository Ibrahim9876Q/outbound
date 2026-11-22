# Prints running processes (id, name, exe path, description) as compact JSON.
param([switch]$PathsOnly)
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$properties = if ($PathsOnly) { @('ProcessName', 'Path') } else { @('Id', 'ProcessName', 'Path', 'Description') }
Get-Process |
  Select-Object -Property $properties |
  ConvertTo-Json -Compress
