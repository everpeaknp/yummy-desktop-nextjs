const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  testNetworkPrinter: (options) => ipcRenderer.invoke('test-network-printer', options),
  printNetworkRaw: (options) => ipcRenderer.invoke('print-network-raw', options)
});
