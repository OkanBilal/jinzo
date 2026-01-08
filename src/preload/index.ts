import { contextBridge, ipcRenderer } from "electron";

// Expose IPC methods to renderer process
const api = {
  // Database operations
  database: {
    getFeedItems: (limit?: number) => ipcRenderer.invoke("db:getFeedItems", limit),
    getFeedItemById: (id: number) => ipcRenderer.invoke("db:getFeedItemById", id),
    getChatSessions: (limit?: number) => ipcRenderer.invoke("db:getChatSessions", limit),
    getConnections: () => ipcRenderer.invoke("db:getConnections"),
    getStats: () => ipcRenderer.invoke("db:getStats"),
  },
};

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", api);

export type ApiType = typeof api;
