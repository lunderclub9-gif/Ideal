const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.resolve('release');
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Roaming');
const userData = path.join(appData, 'IDEAL');
const portFile = path.join(userData, 'server-port.txt');

if (!fs.existsSync(path.join(releaseDir, 'win-unpacked'))) {
  throw new Error('win-unpacked directory is missing.');
}
const exe = path.resolve('release', 'win-unpacked', 'IDEAL.exe');
if (!fs.existsSync(exe)) throw new Error('Packaged executable is missing.');

if (!fs.existsSync(portFile)) throw new Error('Smoke test did not create server-port.txt.');
const port = Number(fs.readFileSync(portFile, 'utf8').trim());
if (!Number.isInteger(port) || port <= 0) throw new Error('Invalid packaged server port.');

const installer = path.join(releaseDir, 'IDEAL-Setup-0.1.' + process.env.GITHUB_RUN_NUMBER + '.exe');
if (!fs.existsSync(installer)) throw new Error('Installer executable is missing.');

const latestYml = path.join(releaseDir, 'latest.yml');
if (!fs.existsSync(latestYml)) throw new Error('latest.yml is missing.');
const metadataText = fs.readFileSync(latestYml, 'utf8');
if (!metadataText.includes('IDEAL-Setup-0.1.' + process.env.GITHUB_RUN_NUMBER + '.exe')) throw new Error('latest.yml does not reference the versioned installer.');

const http = require('node:http');
http.get(`http://127.0.0.1:${port}/`, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) throw new Error(`Packaged UI returned HTTP ${res.statusCode}.`);
    if (!body.includes('IDEAL')) throw new Error('Packaged UI did not return the IDEAL application.');
    process.exit(0);
  });
}).on('error', (error) => {
  console.error(error);
  process.exit(1);
});
