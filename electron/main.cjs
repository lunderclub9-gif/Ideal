const { app, BrowserWindow, dialog, shell } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');

let serverProcess = null;
let mainWindow = null;
let shuttingDown = false;
const APP_URL_HOST = '127.0.0.1';

function waitForServer(child, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Le serveur local n’a pas démarré dans le délai prévu.')), timeoutMs);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/GESTIONPRO_SERVER_READY:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      if (output.length > 12000) output = output.slice(-6000);
    });
    child.stderr.on('data', (chunk) => {
      const message = chunk.toString();
      console.error(message);
      if (/GESTIONPRO_STARTUP_ERROR|GESTIONPRO_SERVER_ERROR/.test(message)) {
        clearTimeout(timeout);
        reject(new Error(message));
      }
    });
    child.once('exit', (code) => {
      if (!shuttingDown) {
        clearTimeout(timeout);
        reject(new Error(`Le serveur local s’est arrêté (code ${code ?? 'inconnu'}).`));
      }
    });
  });
}

function startLocalServer() {
  const serverPath = path.join(app.getAppPath(), 'dist-server', 'server.cjs');
  const dataPath = path.join(app.getPath('userData'), 'data');
  serverProcess = fork(serverPath, [], {
    cwd: app.getAppPath(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production', HOST: APP_URL_HOST, PORT: '0', GESTIONPRO_DATA_DIR: dataPath },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return waitForServer(serverProcess);
}

async function createMainWindow() {
  const port = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680, show: false,
    title: 'GestionPro DZ', autoHideMenuBar: true, backgroundColor: '#f8fafc',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(`http://${APP_URL_HOST}:${port}`);
}

function stopServer() {
  shuttingDown = true;
  if (serverProcess && !serverProcess.killed) { serverProcess.kill(); serverProcess = null; }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('dz.gestionpro.desktop');
    try { await createMainWindow(); }
    catch (error) { stopServer(); dialog.showErrorBox('GestionPro DZ', error?.message || 'Impossible de démarrer le serveur local.'); app.quit(); }
  });
}
app.on('before-quit', stopServer);
app.on('window-all-closed', () => { stopServer(); app.quit(); });
