const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  launchService: (service) => ipcRenderer.send('launch-service', service),
  getSortedServices: () => ipcRenderer.invoke('get-sorted-services'),
  getIntegrationStatus: () => ipcRenderer.invoke('get-integration-status'),
  setupSteam: selection => ipcRenderer.invoke('setup-steam', selection),
  setBrowserReturn: enabled => ipcRenderer.invoke('set-browser-return', enabled),
  returnFromBrowser: () => ipcRenderer.invoke('return-from-browser'),
  dashboardBack: () => ipcRenderer.invoke('dashboard-back')
});
