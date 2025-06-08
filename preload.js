const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    launchService: (serviceName) => ipcRenderer.send('launch-service', serviceName),
    getSortedServices: () => ipcRenderer.invoke('get-sorted-services')
});
