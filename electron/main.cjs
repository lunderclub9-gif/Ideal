const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');

let serverProcess = null;
let mainWindow = null;
let shuttingDown = false;
const APP_URL_HOST = '127.0.0.1';
let startupLogPath = null;
let updateStatus = { state: 'idle', version: null, percent: 0, message: 'Les mises à jour seront vérifiées automatiquement.' };

function publishUpdateStatus(patch) {
  updateStatus = { ...updateStatus, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gestionpro:update-status', updateStatus);
}

function configureAutoUpdater() {
  if (!app.isPackaged || process.env.GESTIONPRO_SMOKE_TEST === '1') return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = 'latest';
  autoUpdater.on('checking-for-update', () => publishUpdateStatus({ state: 'checking', message: 'Recherche de mises à jour…', percent: 0 }));
  autoUpdater.on('update-available', info => publishUpdateStatus({ state: 'available', version: info.version, message: `Mise à jour ${info.version} disponible. Téléchargement…`, percent: 0 }));
  autoUpdater.on('update-not-available', info => publishUpdateStatus({ state: 'up-to-date', version: info.version, message: 'Votre application est à jour.', percent: 0 }));
  autoUpdater.on('download-progress', progress => publishUpdateStatus({ state: 'downloading', percent: Math.round(progress.percent || 0), message: `Téléchargement de la mise à jour : ${Math.round(progress.percent || 0)} %` }));
  autoUpdater.on('update-downloaded', info => publishUpdateStatus({ state: 'downloaded', version: info.version, percent: 100, message: `La mise à jour ${info.version} est prête à installer.` }));
  autoUpdater.on('error', error => {
    logStartup(`AUTO UPDATE ERROR: ${error?.stack || error}`);
    publishUpdateStatus({ state: 'error', message: 'Impossible de vérifier ou télécharger la mise à jour. Réessayez lorsque la connexion Internet sera disponible.' });
  });
  ipcMain.handle('gestionpro:get-version', () => app.getVersion());
  ipcMain.handle('gestionpro:get-update-status', () => updateStatus);
  ipcMain.handle('gestionpro:check-updates', async () => {
    try {
      if (updateStatus.state === 'checking' || updateStatus.state === 'downloading') return updateStatus;
      await autoUpdater.checkForUpdates();
      return updateStatus;
    } catch (error) {
      publishUpdateStatus({ state: 'error', message: 'تعذر الاتصال بخادم التحديثات. تحقق من الإنترنت ثم أعد المحاولة.' });
      return updateStatus;
    }
  });
  ipcMain.handle('gestionpro:install-update', async () => {
    if (updateStatus.state !== 'downloaded') return false;
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['إنشاء نسخة احتياطية ثم التثبيت', 'إلغاء'], defaultId: 1, cancelId: 1,
      title: 'تثبيت تحديث GestionPro DZ',
      message: 'قبل التحديث، تأكد من إنشاء نسخة احتياطية حديثة من قسم «النسخ الاحتياطي والاستعادة».',
      detail: 'سيتم إغلاق البرنامج وإعادة تشغيله بعد التثبيت. لن يحذف التحديث بيانات الشركة المحفوظة في AppData.'
    });
    if (choice.response !== 0) return false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  });
}

function logStartup(message) {
  try {
    if (startupLogPath) fs.appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
  } catch {}
}

function waitForServer(child, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Le serveur local n’a pas démarré dans le délai prévu.')), timeoutMs);
    child.once('error', (error) => { logStartup(`Server process error: ${error.stack || error}`); clearTimeout(timeout); reject(error); });
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      logStartup(`SERVER STDOUT: ${chunk.toString().trim()}`);
      const match = output.match(/GESTIONPRO_SERVER_READY:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      if (output.length > 12000) output = output.slice(-6000);
    });
    child.stderr.on('data', (chunk) => {
      const message = chunk.toString();
      console.error(message);
      logStartup(`SERVER STDERR: ${message.trim()}`);
      if (/GESTIONPRO_STARTUP_ERROR|GESTIONPRO_SERVER_ERROR/.test(message)) {
        clearTimeout(timeout);
        reject(new Error(message));
      }
    });
    child.once('exit', (code) => {
      if (!shuttingDown) {
        logStartup(`Server process exited with code ${code ?? 'unknown'}`);
        clearTimeout(timeout);
        reject(new Error(`Le serveur local s’est arrêté (code ${code ?? 'inconnu'}).`));
      }
    });
  });
}

function startLocalServer() {
  // Child processes cannot execute JavaScript directly from inside app.asar.
  // electron-builder unpacks dist-server so the bundled server can be spawned reliably.
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-server', 'server.cjs')
    : path.join(app.getAppPath(), 'dist-server', 'server.cjs');
  const userDataPath = app.getPath('userData');
  startupLogPath = path.join(userDataPath, 'startup.log');
  const dataPath = path.join(userDataPath, 'data');
  const secretPath = path.join(userDataPath, 'session-secret');
  fs.mkdirSync(userDataPath, { recursive: true });
  let sessionSecret;
  if (fs.existsSync(secretPath)) sessionSecret = fs.readFileSync(secretPath, 'utf8').trim();
  else {
    sessionSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(secretPath, sessionSecret, { encoding: 'utf8', mode: 0o600 });
  }
  logStartup(`Starting local server. executable=${process.execPath}; server=${serverPath}; serverExists=${fs.existsSync(serverPath)}; appPath=${app.getAppPath()}; resources=${process.resourcesPath}`);
  if (!fs.existsSync(serverPath)) throw new Error(`Le serveur intégré est introuvable : ${serverPath}`);
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: process.resourcesPath,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production', HOST: APP_URL_HOST, PORT: '0', GESTIONPRO_DATA_DIR: dataPath, GESTIONPRO_APP_ROOT: app.getAppPath(), NODE_PATH: path.join(app.getAppPath(), 'node_modules'), SESSION_SECRET: sessionSecret },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  return waitForServer(serverProcess);
}

async function createMainWindow() {
  const port = await startLocalServer();
  if (process.env.GESTIONPRO_SMOKE_TEST === '1') {
    fs.writeFileSync(path.join(app.getPath('userData'), 'server-port.txt'), String(port), 'utf8');
  }
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680, show: false,
    title: 'GestionPro DZ', autoHideMenuBar: true, backgroundColor: '#f8fafc',
    webPreferences: { preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
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
    app.setPath('userData', process.env.GESTIONPRO_SMOKE_USER_DATA || path.join(app.getPath('appData'), 'GestionPro-DZ'));
    app.setAppUserModelId('dz.gestionpro.desktop');
    try { await createMainWindow(); configureAutoUpdater(); if (app.isPackaged && process.env.GESTIONPRO_SMOKE_TEST !== '1') setTimeout(() => autoUpdater.checkForUpdates().catch(error => { logStartup(`AUTO UPDATE CHECK ERROR: ${error?.stack || error}`); }), 5000); }
    catch (error) { logStartup(`APPLICATION STARTUP ERROR: ${error?.stack || error}`); stopServer(); if (process.env.GESTIONPRO_SMOKE_TEST !== '1') dialog.showErrorBox('GestionPro DZ', error?.message || 'Impossible de démarrer le serveur local.'); app.quit(); }
  });
}
app.on('before-quit', stopServer);
app.on('window-all-closed', () => { stopServer(); app.quit(); });
