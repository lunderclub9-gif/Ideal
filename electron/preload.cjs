const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gestionProDesktop', {
  getVersion: () => ipcRenderer.invoke('gestionpro:get-version'),
  getUpdateStatus: () => ipcRenderer.invoke('gestionpro:get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('gestionpro:check-updates'),
  installUpdate: () => ipcRenderer.invoke('gestionpro:install-update'),
  onUpdateStatus: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('gestionpro:update-status', listener);
    return () => ipcRenderer.removeListener('gestionpro:update-status', listener);
  }
});
