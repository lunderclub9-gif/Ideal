# IDEAL — Microsoft Store distribution

IDEAL currently ships a Windows NSIS installer from GitHub Releases. That installer is not Authenticode-signed, so Windows may show an unknown-publisher / SmartScreen warning. A self-signed certificate does not establish public publisher trust.

The zero-certificate-cost public distribution path is:

1. Register a Microsoft Store developer account through the official free onboarding flow: https://storedeveloper.microsoft.com/
2. Complete Microsoft's identity verification. Choose **Individual** only if the Store listing should publish under the developer's personal identity. Choose **Company** only if publishing under a registered legal business identity.
3. In Partner Center, reserve the app name **IDEAL** and create the product.
4. Copy the exact package identity values shown by Partner Center:
   - Package/Identity Name
   - Publisher (the full distinguished name, normally beginning with \`CN=\`)
   - Publisher display name
5. Run the GitHub Actions workflow **Build IDEAL Microsoft Store package** manually from the \`main\` branch and provide those exact values.
6. Download the \`IDEAL-Microsoft-Store-AppX\` workflow artifact and submit the generated \`.appx\` package in Partner Center.
7. Complete the Store listing, age rating, privacy disclosures, screenshots, and certification submission. The app is not publicly listed until Microsoft approves it.

Microsoft signs an accepted MSIX/AppX Store submission with its Store certificate. Store-installed apps therefore receive Microsoft's trusted package signature and avoid the normal SmartScreen download warning. Building an AppX file in GitHub Actions does not itself make IDEAL a Store-verified app.

## Important technical behavior

- The existing NSIS \`.exe\` release workflow remains unchanged for direct GitHub downloads.
- The AppX build is a separate, manually triggered workflow. It does not publish an unreviewed package as a GitHub release and does not replace the current installer.
- Store packages receive updates through Microsoft Store. IDEAL disables its GitHub/electron-updater check when running as a Windows Store package; the existing NSIS edition continues using its current update mechanism.
- IDEAL uses Electron with a local Express server and SQLite. The AppX package retains the full-trust desktop capability required by Electron. Its data directory is managed by the Windows packaged-app profile; do not manually copy production databases during packaging or testing.
- No private signing certificate, PFX, password, or signing secret is committed to this repository.
- The Store identity values are public package metadata, not signing secrets. They must match Partner Center exactly or Store package identity validation will fail.
- The package build must be validated on GitHub Actions before Store submission. The final Store certification decision belongs to Microsoft.

## SmartScreen and public trust

Do not distribute a self-signed certificate as a workaround and do not ask customers to install a root certificate. That would weaken security and still would not establish public publisher trust. For direct downloads outside the Store, a trusted OV code-signing certificate is normally paid. The Microsoft Store's MSIX/AppX route is the free route selected for IDEAL.
