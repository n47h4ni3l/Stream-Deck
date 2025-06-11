const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchService: (service) => ipcRenderer.send('launch-service', service),
  getSortedServices: () => ipcRenderer.invoke('get-sorted-services')
});
