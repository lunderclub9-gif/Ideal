const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const exe = path.resolve('release', 'win-unpacked', 'GestionPro DZ.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gestionpro-smoke-'));
const appData = path.join(tempRoot, 'AppData', 'Roaming');
const userData = path.join(appData, 'GestionPro-DZ');
const portFile = path.join(userData, 'server-port.txt');
const startupLogFile = path.join(userData, 'startup.log');
const serverBundle = path.resolve('release', 'win-unpacked', 'resources', 'app.asar.unpacked', 'dist-server', 'server.cjs');
let child;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startApp() {
  try { fs.unlinkSync(portFile); } catch {}
  try { fs.unlinkSync(startupLogFile); } catch {}
  child = spawn(exe, ['--disable-gpu'], {
    env: { ...process.env, APPDATA: appData, GESTIONPRO_SMOKE_TEST: '1', GESTIONPRO_SMOKE_USER_DATA: userData },
    stdio: 'ignore',
    windowsHide: true,
  });
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const diagnostics = fs.existsSync(startupLogFile) ? fs.readFileSync(startupLogFile, 'utf8') : '(startup.log was not created)';
      throw new Error('Desktop application exited early with code ' + child.exitCode + '. Startup diagnostics: ' + diagnostics);
    }
    if (fs.existsSync(portFile)) {
      const port = Number(fs.readFileSync(portFile, 'utf8').trim());
      if (port > 0) return 'http://127.0.0.1:' + port;
    }
    await sleep(400);
  }
  const diagnostics = fs.existsSync(startupLogFile) ? fs.readFileSync(startupLogFile, 'utf8') : '(startup.log was not created)';
  throw new Error('Desktop app did not start its local server within 75 seconds. Bundled server exists=' + fs.existsSync(serverBundle) + '. Startup diagnostics: ' + diagnostics);
}

async function stopApp() {
  if (child && child.pid) {
    try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
    await sleep(800);
    child = null;
  }
}

async function run() {
  if (!fs.existsSync(exe)) throw new Error('Windows packaged executable not found: ' + exe);
  if (!fs.existsSync(serverBundle)) throw new Error('Packaged server bundle was not unpacked: ' + serverBundle);
  const releaseDir = path.resolve('release');
  const updateMetadata = path.join(releaseDir, 'latest.yml');
  const installer = path.join(releaseDir, 'GestionPro-DZ-Setup-0.1.' + process.env.GITHUB_RUN_NUMBER + '.exe');
  if (!fs.existsSync(updateMetadata)) throw new Error('electron-updater metadata latest.yml is missing from the Windows build.');
  const metadataText = fs.readFileSync(updateMetadata, 'utf8');
  if (!metadataText.includes('GestionPro-DZ-Setup-0.1.' + process.env.GITHUB_RUN_NUMBER + '.exe')) throw new Error('latest.yml does not reference the versioned installer.');
  if (!fs.existsSync(installer)) throw new Error('Versioned installer is missing: ' + installer);
  if (!fs.existsSync(installer + '.blockmap')) throw new Error('Installer blockmap is missing; differential update cannot be published.');

  let base = await startApp();
  const page = await fetch(base + '/');
  if (!page.ok) throw new Error('Packaged UI returned HTTP ' + page.status);
  const html = await page.text();
  if (!html.includes('GestionPro')) throw new Error('Packaged UI did not return the GestionPro application.');

  let response = await fetch(base + '/api/auth/setup-status');
  if (!response.ok) throw new Error('Setup status API returned HTTP ' + response.status);
  let state = await response.json();
  if (state.setupRequired !== true) throw new Error('Fresh installation should require first-run setup; default users/data may exist.');

  response = await fetch(base + '/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Smoke Test Company',
      legalForm: 'SARL',
      fullName: 'Smoke Test Owner',
      username: 'smoke_owner',
      password: 'Smoke-Test-Password-2026',
    }),
  });
  if (response.status !== 201) throw new Error('First-run setup failed with HTTP ' + response.status + ': ' + await response.text());
  const created = await response.json();
  if (!created.token || created.user?.username !== 'smoke_owner') throw new Error('First-run setup did not create a valid owner session.');

  response = await fetch(base + '/api/backups/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + created.token },
    body: JSON.stringify({ backup_type: 'manual_local' }),
  });
  if (response.status !== 201) throw new Error('Manual backup failed with HTTP ' + response.status);
  const backup = await response.json();
  if (!backup.verified || !backup.file_name) throw new Error('Backup was not verified.');

  response = await fetch(base + '/api/backups/' + backup.id + '/download', {
    headers: { 'Authorization': 'Bearer ' + created.token },
  });
  if (!response.ok) throw new Error('Backup archive download failed with HTTP ' + response.status);
  const archiveBlob = new Blob([await response.arrayBuffer()], { type: 'application/zip' });
  const restoreForm = new FormData();
  restoreForm.append('archive', archiveBlob, backup.file_name);
  response = await fetch(base + '/api/backups/restore', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + created.token },
    body: restoreForm,
  });
  if (!response.ok) throw new Error('Backup restore failed with HTTP ' + response.status + ': ' + await response.text());
  const restored = await response.json();
  if (!restored.ok || !restored.safetyBackup?.verified) throw new Error('Restore did not create a verified safety backup.');

  response = await fetch(base + '/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: 'Second Company',
      fullName: 'Intruder',
      username: 'second_owner',
      password: 'Another-Password-2026',
    }),
  });
  if (response.status !== 409) throw new Error('One-time setup should reject a second owner creation.');

  await stopApp();
  base = await startApp();

  response = await fetch(base + '/api/auth/setup-status');
  if (!response.ok) throw new Error('Setup status after restart returned HTTP ' + response.status);
  state = await response.json();
  if (state.setupRequired !== false) throw new Error('Company and owner data did not persist after restarting the packaged app.');

  response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'smoke_owner', password: 'Smoke-Test-Password-2026' }),
  });
  if (!response.ok) throw new Error('Owner login failed after restart with HTTP ' + response.status);
  const login = await response.json();
  if (!login.token || login.user?.username !== 'smoke_owner') throw new Error('Owner session could not be restored after restart.');

  response = await fetch(base + '/api/backups', {
    headers: { 'Authorization': 'Bearer ' + login.token },
  });
  if (!response.ok) throw new Error('Backup history could not be read after restart.');
  const backups = await response.json();
  if (!backups.some(item => item.backup_type === 'pre_restore_safety' && item.verified)) {
    throw new Error('Verified pre-restore safety backup did not persist after restart.');
  }

  console.log('SMOKE_TEST_OK: packaged app starts, creates owner, blocks duplicate setup, creates and downloads a verified backup, restores it with a safety copy, preserves SQLite after restart, and authenticates owner.');
  console.log('UPDATE_METADATA_OK: latest.yml, versioned installer, and installer blockmap are present.');
}

run().catch(error => {
  console.error('SMOKE_TEST_FAILED:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await stopApp();
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});
