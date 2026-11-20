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
  $header = New-Object byte[] 2
  if ($stream.Read($header, 0, 2) -ne 2 -or $header[0] -ne 0x4D -or $header[1] -ne 0x5A) {
    throw "Installer does not have a valid Windows executable header."
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
