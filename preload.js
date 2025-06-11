const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchService: (url) => ipcRenderer.send('launch-service', url)
});