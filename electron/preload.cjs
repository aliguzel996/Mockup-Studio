const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rms', {
  getRuntimeInfo: () => ipcRenderer.invoke('rms:runtime-info'),
  capturePage: (options) => ipcRenderer.invoke('rms:capture-page', options),
  capturePageSvg: (options) => ipcRenderer.invoke('rms:capture-page-svg', options),
  saveImage: (request) => ipcRenderer.invoke('rms:save-image', request),
  saveSvg: (request) => ipcRenderer.invoke('rms:save-svg', request),
  showItemInFolder: (path) => ipcRenderer.invoke('rms:show-item', path),
  readImageFile: (kind) => ipcRenderer.invoke('rms:read-image', kind),
});
