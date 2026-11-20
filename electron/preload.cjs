const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('idealDesktop', {
  getVersion: () => ipcRenderer.invoke('ideal:get-version'),
  getUpdateStatus: () => ipcRenderer.invoke('ideal:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('ideal:check-updates'),
  installUpdate: () => ipcRenderer.invoke('ideal:install-update'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('ideal:update-status', listener);
    return () => ipcRenderer.removeListener('ideal:update-status', listener);
  }
});
