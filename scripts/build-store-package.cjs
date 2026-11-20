const { build, Platform, Arch } = require('electron-builder');

const identityName = process.env.IDEAL_STORE_IDENTITY_NAME?.trim();
const publisher = process.env.IDEAL_STORE_PUBLISHER?.trim();
const publisherDisplayName = process.env.IDEAL_STORE_PUBLISHER_DISPLAY_NAME?.trim();

if (!identityName || !publisher || !publisherDisplayName) {
  console.error('Missing Microsoft Store identity. Set IDEAL_STORE_IDENTITY_NAME, IDEAL_STORE_PUBLISHER, and IDEAL_STORE_PUBLISHER_DISPLAY_NAME using exact Partner Center values.');
  process.exit(2);
}
if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(identityName)) {
  console.error('IDEAL_STORE_IDENTITY_NAME must be the exact dot-separated package identity from Partner Center.');
  process.exit(2);
}
if (!/^CN=.+/.test(publisher)) {
  console.error('IDEAL_STORE_PUBLISHER must be the exact Publisher distinguished name from Partner Center.');
  process.exit(2);
}

async function main() {
  const artifacts = await build({
    targets: Platform.WINDOWS.createTarget(['appx'], Arch.x64),
    config: {
      productName: 'IDEAL',
      appId: 'dz.ideal.desktop',
      win: { target: [{ target: 'appx', arch: ['x64'] }] },
      appx: {
        applicationId: 'IDEAL',
        identityName,
        publisher,
        publisherDisplayName,
        displayName: 'IDEAL',
        languages: ['fr-FR'],
        minVersion: '10.0.19041.0',
        maxVersionTested: '10.0.26100.0',
        backgroundColor: '#0F766E'
      }
    }
  });
  const packages = artifacts.filter(file => /\.appx$/i.test(file));
  if (packages.length === 0) throw new Error('No .appx package was produced.');
  for (const file of packages) console.log('STORE_PACKAGE_READY:', file);
}
main().catch(error => {
  console.error('STORE_PACKAGE_FAILED:', error?.stack || error);
  process.exitCode = 1;
});
