# IDEAL — Windows installation trust and safety

## What this build verifies

Every automated Windows release runs a packaging verification step before publication. It checks that the installer exists, is a Windows executable, has plausible file size and IDEAL product metadata, and has no invalid Authenticode signature. It also creates a SHA-256 checksum manifest that is published beside the installer.

The verifier deliberately treats an **unsigned** installer as an expected state for the free GitHub distribution path. It does not pretend that a checksum is a digital signature or that an unsigned installer has a trusted publisher identity.

## Why Windows may still show a warning

SmartScreen reputation and Authenticode signing are separate from whether an application is legitimate. A new unsigned download can show an unknown-publisher or reputation warning even when the installer passes the repository's checks. This warning cannot be reliably removed by changing the app name, icon, installer settings, or manifest.

For public direct downloads, use a trusted code-signing certificate. For a no-certificate-cost public distribution route, submit the app to Microsoft Store and wait for Microsoft's certification and signing. Neither route is replaced by the checksum file.

## Safe installation guidance

1. Download IDEAL only from the official repository's Releases page.
2. Download `IDEAL-SHA256SUMS.txt` from the same release.
3. In PowerShell, calculate the installer hash with: `Get-FileHash .\\IDEAL-Setup-0.1.xxx.exe -Algorithm SHA256`
4. Compare the `Hash` value with the corresponding line in the checksum manifest. A mismatch means the file must not be installed.
5. If Windows displays a warning, do not disable Defender or SmartScreen globally. Verify the download source and checksum first. If unsure, cancel installation.
6. Keep a separate backup of the company's data before updating or uninstalling.

## Data preservation

The NSIS configuration remains per-user, does not request an administrator install by default, and preserves IDEAL's local AppData on uninstall. Do not delete the IDEAL data folder manually unless a verified backup exists.

## Limits

- SHA-256 detects file changes only when the expected checksum is obtained through a trusted channel. It does not prove who built the installer.
- The CI signature check rejects invalid signatures but accepts the expected unsigned build.
- This workflow does not submit IDEAL to Microsoft, create a publisher certificate, or guarantee SmartScreen reputation.
