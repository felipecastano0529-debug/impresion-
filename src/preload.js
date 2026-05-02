// Bridge entre la ventana de setup (renderer aislado) y el main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  saveConfig: (cfg) => ipcRenderer.invoke("config:save", cfg),
  printTest: () => ipcRenderer.invoke("printer:test"),
  onStatus: (cb) => {
    const listener = (_e, status) => cb(status);
    ipcRenderer.on("status", listener);
    return () => ipcRenderer.removeListener("status", listener);
  },
});
