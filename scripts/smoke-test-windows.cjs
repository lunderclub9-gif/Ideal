const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const exe = path.resolve('release', 'win-unpacked', 'GestionPro DZ.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gestionpro-smoke-'));
const appData = path.join(tempRoot, 'AppData', 'Roaming');
const userData = path.join(appData, 'GestionPro-DZ');
const portFile = path.join(userData, 'server-port.txt');
let child;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  if (!fs.existsSync(exe)) throw new Error('Windows packaged executable not found: ' + exe);
  child = spawn(exe, [], {
    env: { ...process.env, APPDATA: appData, GESTIONPRO_SMOKE_TEST: '1' },
    stdio: 'ignore',
    windowsHide: true,
  });

  const deadline = Date.now() + 45000;
  let port = 0;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Desktop application exited early with code ' + child.exitCode);
    if (fs.existsSync(portFile)) {
      port = Number(fs.readFileSync(portFile, 'utf8').trim());
      if (port > 0) break;
    }
    await sleep(400);
  }
  if (!port) throw new Error('Desktop app did not start its local server within 45 seconds.');

  const base = 'http://127.0.0.1:' + port;
  const page = await fetch(base + '/');
  if (!page.ok) throw new Error('Packaged UI returned HTTP ' + page.status);
  const html = await page.text();
  if (!html.includes('GestionPro')) throw new Error('Packaged UI did not return the GestionPro application.');

  const setup = await fetch(base + '/api/auth/setup-status');
  if (!setup.ok) throw new Error('Setup status API returned HTTP ' + setup.status);
  const state = await setup.json();
  if (state.setupRequired !== true) throw new Error('Fresh installation should require first-run setup; demo users/data may exist.');

  console.log('SMOKE_TEST_OK: packaged Electron app launched, SQLite opened, UI served, setup API reachable, and no default users seeded.');
}

async function cleanup() {
  if (child && child.pid) {
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {}
  }
  await sleep(700);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}

run().catch(error => {
  console.error('SMOKE_TEST_FAILED:', error.message);
  process.exitCode = 1;
}).finally(cleanup);
