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
  // Account operations
  account: {
    get: () => ipcRenderer.invoke("account:get"),
    update: (payload: unknown) => ipcRenderer.invoke("account:update", payload),
  },
  // Apps operations
  apps: {
    getAll: () => ipcRenderer.invoke("apps:getAll"),
    updateById: (id: string, payload: { isConnected: boolean; connectionId?: string | null }) => 
      ipcRenderer.invoke("apps:updateById", id, payload),
  },
  // Chat operations
  chat: {
    getConfig: () => ipcRenderer.invoke("chat:getConfig"),
    updateConfig: (payload: unknown) => ipcRenderer.invoke("chat:updateConfig", payload),
    getSessions: () => ipcRenderer.invoke("chat:getSessions"),
    getMessages: (sessionId: number) => ipcRenderer.invoke("chat:getMessages", sessionId),
    createSession: (payload: unknown) => ipcRenderer.invoke("chat:createSession", payload),
    deleteSession: (sessionId: number) => ipcRenderer.invoke("chat:deleteSession", sessionId),
    send: (payload: unknown) => ipcRenderer.invoke("chat:send", payload),
    onStreamChunk: (callback: (data: { sessionId: number; content: string }) => void) => {
      const listener = (_: any, data: { sessionId: number; content: string }) => callback(data);
      ipcRenderer.on('chat:stream-chunk', listener);
      return () => ipcRenderer.removeListener('chat:stream-chunk', listener);
    },
    onStreamFinal: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on('chat:stream-final', listener);
      return () => ipcRenderer.removeListener('chat:stream-final', listener);
    },
    onStreamError: (callback: (data: { sessionId: number; error: string }) => void) => {
      const listener = (_: any, data: { sessionId: number; error: string }) => callback(data);
      ipcRenderer.on('chat:stream-error', listener);
      return () => ipcRenderer.removeListener('chat:stream-error', listener);
    },
  },
  // Cron operations
  cron: {
    runFeedSync: () => ipcRenderer.invoke("cron:runFeedSync"),
  },
  // Feed operations
  feed: {
    getItems: (options?: { sources?: string[]; itemTypes?: string[]; limit?: number }) => 
      ipcRenderer.invoke("feed:getItems", options),
  },
  // MCP (Model Context Protocol) operations
  mcp: {
    listTools: () => ipcRenderer.invoke("mcp:listTools"),
    callTool: (payload: { name: string; arguments?: any }) => 
      ipcRenderer.invoke("mcp:callTool", payload),
  },
  // Ollama operations
  ollama: {
    getModels: () => ipcRenderer.invoke("ollama:getModels"),
    showModel: (modelName: string) => ipcRenderer.invoke("ollama:showModel", modelName),
    getWeatherInsight: (payload: { temperature: number; weatherCode: number; windspeed?: number; location: { lat: number; lon: number } }) => 
      ipcRenderer.invoke("ollama:getWeatherInsight", payload),
  },
  // Connection credentials operations
  connectionCredentials: {
    save: (payload: { provider: string; connectionId: string; [key: string]: any }) => 
      ipcRenderer.invoke("connections:saveCredentials", payload),
    check: (provider: string) => ipcRenderer.invoke("connections:checkCredentials", provider),
  },
  // Connections operations
  connections: {
    getGithubRepos: (connectionId: string) => ipcRenderer.invoke("connections:getGithubRepos", connectionId),
    getRaindropCollections: (connectionId: string) => ipcRenderer.invoke("connections:getRaindropCollections", connectionId),
    getHackerNewsStatus: () => ipcRenderer.invoke("connections:getHackerNewsStatus"),
    toggleHackerNews: (payload: { enabled: boolean; username?: string; topStories?: boolean; userSubmissions?: boolean; userComments?: boolean }) => 
      ipcRenderer.invoke("connections:toggleHackerNews", payload),
    saveResources: (payload: { provider: string; connectionId: string; resources?: any[]; sources?: string[] }) => 
      ipcRenderer.invoke("connections:saveResources", payload),
    deleteResource: (resourceId: string) => ipcRenderer.invoke("connections:deleteResource", resourceId),
    revoke: (provider: string) => ipcRenderer.invoke("connections:revoke", provider),
    getByProvider: (provider: string) => ipcRenderer.invoke("connections:getByProvider", provider),
    getSelectedResources: (provider: string) => ipcRenderer.invoke("connections:getSelectedResources", provider),
    getRssStatus: () => ipcRenderer.invoke("connections:getRssStatus"),
    toggleRss: (enabled: boolean) => ipcRenderer.invoke("connections:toggleRss", enabled),
  },
};

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", api);

export type ApiType = typeof api;
