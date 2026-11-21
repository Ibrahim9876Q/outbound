# Reads a JSON array of exe paths on stdin, prints { path: base64Png } for each icon it can extract.
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$paths = [Console]::In.ReadToEnd() | ConvertFrom-Json
$out = @{}
foreach ($p in $paths) {
  if (-not (Test-Path -LiteralPath $p)) { continue }
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($p)
  if ($null -eq $icon) { continue }
  $bmp = $icon.ToBitmap()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $out[$p] = [Convert]::ToBase64String($ms.ToArray())
  $bmp.Dispose(); $icon.Dispose(); $ms.Dispose()
}
$out | ConvertTo-Json -Compress
