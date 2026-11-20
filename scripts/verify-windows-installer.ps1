param(
  [string]$ReleaseDirectory = "release"
)

$ErrorActionPreference = "Stop"
$installer = Get-ChildItem -Path $ReleaseDirectory -Filter "IDEAL-Setup-*.exe" -File |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

if (-not $installer) { throw "No IDEAL Windows installer was found in '$ReleaseDirectory'." }
if ($installer.Length -lt 10MB) { throw "Installer is unexpectedly small ($($installer.Length) bytes)." }

$stream = [System.IO.File]::OpenRead($installer.FullName)
try {
  $dosHeader = New-Object byte[] 64
  if ($stream.Read($dosHeader, 0, 64) -ne 64 -or $dosHeader[0] -ne 0x4D -or $dosHeader[1] -ne 0x5A) {
    throw "Installer does not have a valid Windows DOS executable header."
  }
  $peOffset = [BitConverter]::ToInt32($dosHeader, 0x3C)
  if ($peOffset -lt 64 -or $peOffset -gt ($stream.Length - 4)) {
    throw "Installer has an invalid PE header offset."
  }
  [void]$stream.Seek($peOffset, [System.IO.SeekOrigin]::Begin)
  $peSignature = New-Object byte[] 4
  if ($stream.Read($peSignature, 0, 4) -ne 4 -or
      $peSignature[0] -ne 0x50 -or $peSignature[1] -ne 0x45 -or
      $peSignature[2] -ne 0x00 -or $peSignature[3] -ne 0x00) {
    throw "Installer does not contain a valid PE signature."
  }
}
finally { $stream.Dispose() }

$version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($installer.FullName)
if ($version.ProductName -and $version.ProductName -notmatch "IDEAL") {
  throw "Unexpected installer product metadata: '$($version.ProductName)'."
}

$signature = Get-AuthenticodeSignature -FilePath $installer.FullName
if ($signature.Status -eq "Valid") {
  Write-Host "Authenticode signature: VALID ($($signature.SignerCertificate.Subject))"
}
elseif ($signature.Status -eq "NotSigned") {
  Write-Warning "Installer is not Authenticode-signed. This is expected for the free GitHub distribution path; SmartScreen reputation warnings may still appear."
}
else {
  throw "Installer has an invalid Authenticode signature: $($signature.Status) — $($signature.StatusMessage)"
}

$hash = (Get-FileHash -Path $installer.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$manifest = Join-Path $ReleaseDirectory "IDEAL-SHA256SUMS.txt"
"$hash  $($installer.Name)" | Set-Content -Path $manifest -Encoding ascii

Write-Host "Installer: $($installer.Name)"
Write-Host "Size: $($installer.Length) bytes"
Write-Host "Product: $($version.ProductName)"
Write-Host "File version: $($version.FileVersion)"
Write-Host "SHA-256: $hash"
Write-Host "Checksum manifest: $manifest"
