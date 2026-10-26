// Місток між вікном і оболонкою. Гра бачить лише window.hhn — без доступу до диска чи Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hhn', {
  platform: 'desktop',
  info: () => ipcRenderer.invoke('hhn:info'),
  // для вікна-лаунчера
  launcher: {
    state: () => ipcRenderer.invoke('launcher:state'),
    retry: () => ipcRenderer.invoke('launcher:retry'),
    onStatus: cb => {
      const h = (_e, s) => cb(s);
      ipcRenderer.on('launcher:status', h);
      return () => ipcRenderer.removeListener('launcher:status', h);
    },
  },
});
