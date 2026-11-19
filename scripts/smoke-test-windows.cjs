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
    if (child.exitCode !== null) throw new Error('Desktop application exited early with code ' + child.exitCode);
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

  console.log('SMOKE_TEST_OK: packaged Electron app starts, serves the UI, creates a first owner, blocks duplicate setup, preserves SQLite data after restart, and authenticates the owner.');
}

run().catch(error => {
  console.error('SMOKE_TEST_FAILED:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  await stopApp();
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});
