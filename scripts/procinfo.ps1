# Prints running processes (id, name, exe path, description) as compact JSON.
$ErrorActionPreference = 'SilentlyContinue'
Get-Process |
  Select-Object Id, ProcessName, Path, Description |
  ConvertTo-Json -Compress
