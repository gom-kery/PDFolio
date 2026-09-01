const { contextBridge, ipcRenderer } = require('electron');

// Sandboxed preloads use CommonJS. No filesystem or raw IPC API is exposed.
contextBridge.exposeInMainWorld('localPdfCbt', {
  runtimeInfo: {
    electronVersion: process.versions.electron,
    platform: process.platform,
  },
  // The renderer cannot supply a path, channel name or dialog options.
  selectPdfFile: () => ipcRenderer.invoke('pdf:select-file'),
});
