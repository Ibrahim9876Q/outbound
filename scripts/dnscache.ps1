# Prints the Windows DNS cache (name an app asked for -> IP it got back) as compact JSON.
# Type 1 = A (IPv4), 28 = AAAA (IPv6), 5 = CNAME.
$ErrorActionPreference = 'SilentlyContinue'
Get-DnsClientCache |
  Where-Object { $_.Type -eq 1 -or $_.Type -eq 28 -or $_.Type -eq 5 } |
  Select-Object Entry, Name, Data, Type |
  ConvertTo-Json -Compress
