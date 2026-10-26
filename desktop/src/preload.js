// Місток між вікном і оболонкою. Гра бачить лише window.hhn — без доступу до диска чи Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hhn', {
  platform: 'desktop',
  info: () => ipcRenderer.invoke('hhn:info'),
  // гра по мережі: усі виклики повертають {ok, error?, ...}
  net: {
    host: o => ipcRenderer.invoke('net:host', o),
    join: o => ipcRenderer.invoke('net:join', o),
    leave: () => ipcRenderer.invoke('net:leave'),
    set: data => ipcRenderer.invoke('net:set', { data }),
    seat: seat => ipcRenderer.invoke('net:seat', { seat }),
    status: () => ipcRenderer.invoke('net:status'),
    addresses: () => ipcRenderer.invoke('net:addresses'),
    on: cb => {
      const h = (_e, ev) => cb(ev);
      ipcRenderer.on('net:event', h);
      return () => ipcRenderer.removeListener('net:event', h);
    },
  },
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
