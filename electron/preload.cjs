const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Sandboxed preloads use CommonJS. No filesystem or raw IPC API is exposed.
contextBridge.exposeInMainWorld('localPdfCbt', {
  runtimeInfo: {
    electronVersion: process.versions.electron,
    platform: process.platform,
  },
  // The renderer cannot supply a path, channel name or dialog options.
  selectPdfFile: () => ipcRenderer.invoke('pdf:select-file'),
  // Only Electron-backed File objects can produce paths; no path is returned to renderer.
  inspectDroppedPdfFiles: (files) => {
    if (!Array.isArray(files))
      return Promise.resolve({ status: 'error', code: 'INVALID_REQUEST' });
    let filePaths;
    try {
      filePaths = files.map((file) => webUtils.getPathForFile(file));
    } catch {
      return Promise.resolve({ status: 'error', code: 'INVALID_DROP_DATA' });
    }
    return ipcRenderer.invoke('pdf:inspect-dropped-files', filePaths);
  },
});
