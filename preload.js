const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** True in Yummy POS desktop shell — use redirect OAuth, not popups. */
  isDesktopShell: true,
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  testNetworkPrinter: (options) => ipcRenderer.invoke('test-network-printer', options),
  printNetworkRaw: (options) => ipcRenderer.invoke('print-network-raw', options),
});
