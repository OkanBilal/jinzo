import { contextBridge, ipcRenderer } from "electron";
import os from "node:os";

// Expose IPC methods to renderer process
const api = {
  // Entity operations (canonical content)
  entities: {
    getAll: (options?: {
      kind?: string;
      connectionId?: string;
      limit?: number;
    }) => ipcRenderer.invoke("entities:getAll", options),
    getById: (id: string) => ipcRenderer.invoke("entities:getById", id),
    create: (payload: unknown) =>
      ipcRenderer.invoke("entities:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("entities:update", id, payload),
    delete: (id: string) => ipcRenderer.invoke("entities:delete", id),
    search: (query: string, options?: { kind?: string; limit?: number }) =>
      ipcRenderer.invoke("entities:search", query, options),
  },
  // Task operations (actionable domain)
  tasks: {
    getAll: (options?: { status?: string; limit?: number }) =>
      ipcRenderer.invoke("tasks:getAll", options),
    getById: (entityId: string) =>
      ipcRenderer.invoke("tasks:getById", entityId),
    create: (payload: unknown) => ipcRenderer.invoke("tasks:create", payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke("tasks:update", entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke("tasks:delete", entityId),
  },
  // Issue operations (actionable domain)
  issues: {
    getAll: (options?: { provider?: string; state?: string; repo?: string; limit?: number }) =>
      ipcRenderer.invoke("issues:getAll", options),
    getById: (entityId: string) =>
      ipcRenderer.invoke("issues:getById", entityId),
    create: (payload: unknown) => ipcRenderer.invoke("issues:create", payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke("issues:update", entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke("issues:delete", entityId),
  },
  // Playlist operations
  playlists: {
    getItems: (playlistEntityId: string) =>
      ipcRenderer.invoke("playlists:getItems", playlistEntityId),
    addItem: (
      playlistEntityId: string,
      itemEntityId: string,
      position?: number,
    ) =>
      ipcRenderer.invoke(
        "playlists:addItem",
        playlistEntityId,
        itemEntityId,
        position,
      ),
    removeItem: (playlistEntityId: string, itemEntityId: string) =>
      ipcRenderer.invoke(
        "playlists:removeItem",
        playlistEntityId,
        itemEntityId,
      ),
    reorderItem: (
      playlistEntityId: string,
      itemEntityId: string,
      newPosition: number,
    ) =>
      ipcRenderer.invoke(
        "playlists:reorderItem",
        playlistEntityId,
        itemEntityId,
        newPosition,
      ),
  },
  // Account operations
  account: {
    get: () => ipcRenderer.invoke("account:get"),
    update: (payload: unknown) => ipcRenderer.invoke("account:update", payload),
  },
  // Apps operations
  apps: {
    getAll: () => ipcRenderer.invoke("apps:getAll"),
    updateById: (
      id: string,
      payload: { isConnected: boolean; connectionId?: string | null },
    ) => ipcRenderer.invoke("apps:updateById", id, payload),
  },
  // Chat operations
  chat: {
    getConfig: () => ipcRenderer.invoke("chat:getConfig"),
    updateConfig: (payload: unknown) =>
      ipcRenderer.invoke("chat:updateConfig", payload),
    getSessions: () => ipcRenderer.invoke("chat:getSessions"),
    getSessionById: (sessionId: number) =>
      ipcRenderer.invoke("chat:getSessionById", sessionId),
    getMessages: (sessionId: number) =>
      ipcRenderer.invoke("chat:getMessages", sessionId),
    createSession: (payload: unknown) =>
      ipcRenderer.invoke("chat:createSession", payload),
    deleteSession: (sessionId: number) =>
      ipcRenderer.invoke("chat:deleteSession", sessionId),
    updateTitle: (sessionId: number, title: string) =>
      ipcRenderer.invoke("chat:updateTitle", sessionId, title),
    generateTitle: (sessionId: number, model?: string) =>
      ipcRenderer.invoke("chat:generateTitle", sessionId, model),
    send: (payload: unknown) => ipcRenderer.invoke("chat:send", payload),
    onStreamChunk: (
      callback: (data: { sessionId: number; content: string }) => void,
    ) => {
      const listener = (_: any, data: { sessionId: number; content: string }) =>
        callback(data);
      ipcRenderer.on("chat:stream-chunk", listener);
      return () => ipcRenderer.removeListener("chat:stream-chunk", listener);
    },
    onStreamFinal: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on("chat:stream-final", listener);
      return () => ipcRenderer.removeListener("chat:stream-final", listener);
    },
    onStreamError: (
      callback: (data: { sessionId: number; error: string }) => void,
    ) => {
      const listener = (_: any, data: { sessionId: number; error: string }) =>
        callback(data);
      ipcRenderer.on("chat:stream-error", listener);
      return () => ipcRenderer.removeListener("chat:stream-error", listener);
    },
    onToolStatus: (
      callback: (data: { sessionId: number; tool: string; status: string }) => void,
    ) => {
      const listener = (_: any, data: { sessionId: number; tool: string; status: string }) =>
        callback(data);
      ipcRenderer.on("chat:tool-status", listener);
      return () => ipcRenderer.removeListener("chat:tool-status", listener);
    },
  },
  // Sync operations
  sync: {
    runEntitySync: () => ipcRenderer.invoke("sync:runEntitySync"),
  },
  // Feed event operations (event log / timeline)
  feed: {
    getEvents: (options?: {
      connectionIds?: string[];
      eventTypes?: string[];
      itemTypes?: string[];
      entityId?: string;
      limit?: number;
    }) => ipcRenderer.invoke("feed:getEvents", options),
    getEventById: (id: number) => ipcRenderer.invoke("feed:getEventById", id),
    getEventsByEntity: (entityId: string) =>
      ipcRenderer.invoke("feed:getEventsByEntity", entityId),
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
    showModel: (modelName: string) =>
      ipcRenderer.invoke("ollama:showModel", modelName),
  },
  // Connection credentials operations
  connectionCredentials: {
    save: (payload: {
      provider: string;
      connectionId: string;
      [key: string]: any;
    }) => ipcRenderer.invoke("connections:saveCredentials", payload),
    check: (provider: string) =>
      ipcRenderer.invoke("connections:checkCredentials", provider),
  },
  // Connections operations
  connections: {
    getGithubRepos: (connectionId: string) =>
      ipcRenderer.invoke("connections:getGithubRepos", connectionId),
    getRaindropCollections: (connectionId: string) =>
      ipcRenderer.invoke("connections:getRaindropCollections", connectionId),
    getLinearTeams: (connectionId: string) =>
      ipcRenderer.invoke("connections:getLinearTeams", connectionId),
    getJiraProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getJiraProjects", connectionId),
    getAsanaProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getAsanaProjects", connectionId),
    getHackerNewsStatus: () =>
      ipcRenderer.invoke("connections:getHackerNewsStatus"),
    toggleHackerNews: (payload: {
      enabled: boolean;
      username?: string;
      topStories?: boolean;
      userSubmissions?: boolean;
      userComments?: boolean;
    }) => ipcRenderer.invoke("connections:toggleHackerNews", payload),
    saveResources: (payload: {
      provider: string;
      connectionId: string;
      resources?: any[];
      sources?: string[];
    }) => ipcRenderer.invoke("connections:saveResources", payload),
    deleteResource: (resourceId: string) =>
      ipcRenderer.invoke("connections:deleteResource", resourceId),
    revoke: (provider: string) =>
      ipcRenderer.invoke("connections:revoke", provider),
    getByProvider: (provider: string) =>
      ipcRenderer.invoke("connections:getByProvider", provider),
    getSelectedResources: (provider: string) =>
      ipcRenderer.invoke("connections:getSelectedResources", provider),
    getRssStatus: () => ipcRenderer.invoke("connections:getRssStatus"),
    toggleRss: (enabled: boolean) =>
      ipcRenderer.invoke("connections:toggleRss", enabled),
  },
  // Workspace Resources operations
  workspaceResources: {
    getByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceResources:getByWorkspace", workspaceId),
    getAvailable: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceResources:getAvailable", workspaceId),
    add: (payload: { workspaceId: string; resourceId: string }) =>
      ipcRenderer.invoke("workspaceResources:add", payload),
    remove: (payload: { workspaceId: string; resourceId: string }) =>
      ipcRenderer.invoke("workspaceResources:remove", payload),
    getIssues: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceResources:getIssues", workspaceId),
  },
  // Seed operations
  seed: {
    apps: () => ipcRenderer.invoke("seed:apps"),
    connections: () => ipcRenderer.invoke("seed:connections"),
    all: () => ipcRenderer.invoke("seed:all"),
  },
  // Mood operations
  mood: {
    getAll: () => ipcRenderer.invoke("mood:getAll"),
    getById: (moodId: string) => ipcRenderer.invoke("mood:getById", moodId),
    create: (payload: unknown) => ipcRenderer.invoke("mood:create", payload),
    update: (moodId: string, payload: unknown) =>
      ipcRenderer.invoke("mood:update", moodId, payload),
    delete: (moodId: string) => ipcRenderer.invoke("mood:delete", moodId),
    archive: (moodId: string) => ipcRenderer.invoke("mood:archive", moodId),
  },
  // App settings operations
  appSettings: {
    get: () => ipcRenderer.invoke("appSettings:get"),
    setActiveMood: (moodId: string | null) =>
      ipcRenderer.invoke("appSettings:setActiveMood", moodId),
    onMoodChanged: (
      callback: (data: { activeMoodId: string | null }) => void,
    ) => {
      const listener = (_: any, data: { activeMoodId: string | null }) =>
        callback(data);
      ipcRenderer.on("mood:changed", listener);
      return () => ipcRenderer.removeListener("mood:changed", listener);
    },
  },
  // Journal operations
  journal: {
    getAll: (options?: { limit?: number }) =>
      ipcRenderer.invoke("journal:getAll", options),
    getById: (id: string) => ipcRenderer.invoke("journal:getById", id),
    createDraft: (payload: {
      accountId: string;
      title?: string;
      body?: string;
      occurredAt?: Date;
    }) => ipcRenderer.invoke("journal:createDraft", payload),
    updateDraft: (
      id: string,
      payload: {
        title?: string;
        body?: string;
        summary?: string;
        metadata?: { status?: "draft" | "published"; wordCount?: number };
      },
    ) => ipcRenderer.invoke("journal:updateDraft", id, payload),
    save: (id: string) => ipcRenderer.invoke("journal:save", id),
    publish: (id: string) => ipcRenderer.invoke("journal:publish", id),
    delete: (id: string) => ipcRenderer.invoke("journal:delete", id),
    getRevisions: (entityId: string, options?: { limit?: number }) =>
      ipcRenderer.invoke("journal:getRevisions", entityId, options),
    markForIndexing: (entityId: string) =>
      ipcRenderer.invoke("journal:markForIndexing", entityId),
    setEditing: (entityId: string | null) =>
      ipcRenderer.invoke("journal:setEditing", entityId),
    getEditing: () => ipcRenderer.invoke("journal:getEditing"),
    appendText: (entityId: string, text: string) =>
      ipcRenderer.invoke("journal:appendText", entityId, text),
    onContentUpdated: (
      callback: (data: {
        entityId: string;
        body: string;
        wordCount: number;
      }) => void,
    ) => {
      const listener = (
        _: any,
        data: { entityId: string; body: string; wordCount: number },
      ) => callback(data);
      ipcRenderer.on("journal:contentUpdated", listener);
      return () =>
        ipcRenderer.removeListener("journal:contentUpdated", listener);
    },
    onTitleUpdated: (
      callback: (data: { entityId: string; title: string }) => void,
    ) => {
      const listener = (
        _: any,
        data: { entityId: string; title: string },
      ) => callback(data);
      ipcRenderer.on("journal:titleUpdated", listener);
      return () =>
        ipcRenderer.removeListener("journal:titleUpdated", listener);
    },
  },
  // Provider operations
  providers: {
    getAll: () => ipcRenderer.invoke("providers:getAll"),
    getById: (id: string) => ipcRenderer.invoke("providers:getById", id),
    getByKind: (kind: "llm_runtime" | "agent_runtime") =>
      ipcRenderer.invoke("providers:getByKind", kind),
    getEnabled: () => ipcRenderer.invoke("providers:getEnabled"),
    create: (payload: unknown) =>
      ipcRenderer.invoke("providers:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("providers:update", id, payload),
    delete: (id: string) => ipcRenderer.invoke("providers:delete", id),
    enable: (id: string) => ipcRenderer.invoke("providers:enable", id),
    disable: (id: string) => ipcRenderer.invoke("providers:disable", id),
    getModels: (id: string) => ipcRenderer.invoke("providers:getModels", id),
    getCommands: (id: string) => ipcRenderer.invoke("providers:getCommands", id),
    getSkills: (id: string, workspacePath?: string) => ipcRenderer.invoke("providers:getSkills", id, workspacePath),
  },
  // Tools operations
  tools: {
    getAll: () => ipcRenderer.invoke("tools:getAll"),
    getById: (id: string) => ipcRenderer.invoke("tools:getById", id),
    getBySource: (source: "local" | "mcp" | "provider_builtin") =>
      ipcRenderer.invoke("tools:getBySource", source),
    getByMcpServer: (mcpServerId: string) =>
      ipcRenderer.invoke("tools:getByMcpServer", mcpServerId),
    getEnabled: () => ipcRenderer.invoke("tools:getEnabled"),
    create: (payload: unknown) => ipcRenderer.invoke("tools:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("tools:update", id, payload),
    delete: (id: string) => ipcRenderer.invoke("tools:delete", id),
  },
  // Tool calls operations
  toolCalls: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke("toolCalls:getByRun", runId),
    getByAccount: (accountId: string, limit?: number) =>
      ipcRenderer.invoke("toolCalls:getByAccount", accountId, limit),
    create: (payload: unknown) =>
      ipcRenderer.invoke("toolCalls:create", payload),
    update: (id: number, payload: unknown) =>
      ipcRenderer.invoke("toolCalls:update", id, payload),
    start: (id: number) => ipcRenderer.invoke("toolCalls:start", id),
    complete: (id: number, output: unknown, latencyMs?: number) =>
      ipcRenderer.invoke("toolCalls:complete", id, output, latencyMs),
    fail: (id: number, error: string) =>
      ipcRenderer.invoke("toolCalls:fail", id, error),
  },
  // Tool permissions operations
  toolPermissions: {
    getByMood: (moodId: string) =>
      ipcRenderer.invoke("toolPermissions:getByMood", moodId),
    set: (payload: { moodId: string; toolId: string; enabled?: boolean; policy?: unknown }) =>
      ipcRenderer.invoke("toolPermissions:set", payload),
    remove: (moodId: string, toolId: string) =>
      ipcRenderer.invoke("toolPermissions:remove", moodId, toolId),
  },
  // Workspaces operations
  workspaces: {
    getAll: () => ipcRenderer.invoke("workspaces:getAll"),
    getById: (id: string) => ipcRenderer.invoke("workspaces:getById", id),
    getByAccount: (accountId: string) =>
      ipcRenderer.invoke("workspaces:getByAccount", accountId),
    getByRootPath: (accountId: string, rootPath: string) =>
      ipcRenderer.invoke("workspaces:getByRootPath", accountId, rootPath),
    create: (payload: unknown) =>
      ipcRenderer.invoke("workspaces:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("workspaces:update", id, payload),
    delete: (id: string) => ipcRenderer.invoke("workspaces:delete", id),
    archive: (id: string) => ipcRenderer.invoke("workspaces:archive", id),
    selectDirectory: () => ipcRenderer.invoke("workspaces:selectDirectory"),
  },
  // Runs operations
  runs: {
    getAll: (limit?: number) => ipcRenderer.invoke("runs:getAll", limit),
    getById: (id: string) => ipcRenderer.invoke("runs:getById", id),
    getByAccount: (accountId: string, limit?: number) =>
      ipcRenderer.invoke("runs:getByAccount", accountId, limit),
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke("runs:getByWorkspace", workspaceId, limit),
    getByStatus: (
      accountId: string,
      status: "queued" | "running" | "succeeded" | "failed" | "canceled",
    ) => ipcRenderer.invoke("runs:getByStatus", accountId, status),
    create: (payload: unknown) => ipcRenderer.invoke("runs:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("runs:update", id, payload),
    start: (id: string) => ipcRenderer.invoke("runs:start", id),
    complete: (id: string) => ipcRenderer.invoke("runs:complete", id),
    fail: (id: string, error: string) =>
      ipcRenderer.invoke("runs:fail", id, error),
    cancel: (id: string) => ipcRenderer.invoke("runs:cancel", id),
    delete: (id: string) => ipcRenderer.invoke("runs:delete", id),
    archive: (id: string) => ipcRenderer.invoke("runs:archive", id),
    // New methods for executing work runs
    getDetails: (runId: string) => ipcRenderer.invoke("runs:getDetails", runId),
    execute: (payload: {
      accountId: string;
      workspaceId: string;
      moodId?: string;
      providerId: string;
      goal: string;
      model?: string;
      systemPrompt?: string;
      initialContext?: Array<{
        kind: "file" | "diff" | "selection" | "note";
        ref?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }>;
      configSnapshot?: Record<string, unknown>;
      toolPolicySnapshot?: Record<string, unknown>;
    }) => ipcRenderer.invoke("runs:execute", payload),
    abort: (runId: string) => ipcRenderer.invoke("runs:abort", runId),
    getToolCalls: (runId: string) =>
      ipcRenderer.invoke("runToolCalls:getByRun", runId),
    // Session resume methods
    continue: (payload: {
      runId: string;
      accountId: string;
      message: string;
      additionalContext?: Array<{
        kind: "file" | "diff" | "selection" | "note";
        ref?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }>;
    }) => ipcRenderer.invoke("runs:continue", payload),
    canResume: (runId: string) => ipcRenderer.invoke("runs:canResume", runId),
    deleteSession: (runId: string) =>
      ipcRenderer.invoke("runs:deleteSession", runId),
    // Interactive tool approval
    onToolApprovalRequest: (callback: (request: any) => void) => {
      const listener = (_: any, request: any) => callback(request);
      ipcRenderer.on("runs:toolApprovalRequest", listener);
      return () =>
        ipcRenderer.removeListener("runs:toolApprovalRequest", listener);
    },
    respondToolApproval: (response: {
      requestId: string;
      approved: boolean;
      answer?: string;
    }) => ipcRenderer.invoke("runs:toolApprovalResponse", response),
  },
  // Reviews operations
  reviews: {
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke("reviews:getByWorkspace", workspaceId, limit),
    getById: (id: string) =>
      ipcRenderer.invoke("reviews:getById", id),
    create: (payload: unknown) =>
      ipcRenderer.invoke("reviews:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("reviews:update", id, payload),
    delete: (id: string) =>
      ipcRenderer.invoke("reviews:delete", id),
  },
  // Workspace diff operations
  workspaceDiffs: {
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke("workspaceDiffs:getByWorkspace", workspaceId, limit),
    getLatest: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceDiffs:getLatest", workspaceId),
    getByRun: (runId: string) =>
      ipcRenderer.invoke("workspaceDiffs:getByRun", runId),
  },
  // Run context operations
  runContext: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke("runContext:getByRun", runId),
    add: (payload: unknown) => ipcRenderer.invoke("runContext:add", payload),
    remove: (id: number) => ipcRenderer.invoke("runContext:remove", id),
  },
  // Run artifacts operations
  runArtifacts: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke("runArtifacts:getByRun", runId),
    add: (payload: unknown) => ipcRenderer.invoke("runArtifacts:add", payload),
    remove: (id: number) => ipcRenderer.invoke("runArtifacts:remove", id),
  },
  // Run commands operations
  runCommands: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke("runCommands:getByRun", runId),
    add: (payload: unknown) => ipcRenderer.invoke("runCommands:add", payload),
    update: (id: number, payload: unknown) =>
      ipcRenderer.invoke("runCommands:update", id, payload),
    start: (id: number) => ipcRenderer.invoke("runCommands:start", id),
    complete: (id: number, exitCode: number, stdout?: string, stderr?: string) =>
      ipcRenderer.invoke("runCommands:complete", id, exitCode, stdout, stderr),
    remove: (id: number) => ipcRenderer.invoke("runCommands:remove", id),
  },
  // File explorer operations
  fileExplorer: {
    readDirectory: (options: {
      rootPath: string;
      depth?: number;
      includeHidden?: boolean;
      excludePatterns?: string[];
    }) => ipcRenderer.invoke("fileExplorer:readDirectory", options),
    readDirectoryShallow: (
      dirPath: string,
      options?: { includeHidden?: boolean; excludePatterns?: string[] }
    ) => ipcRenderer.invoke("fileExplorer:readDirectoryShallow", dirPath, options),
    getPathInfo: (targetPath: string) =>
      ipcRenderer.invoke("fileExplorer:getPathInfo", targetPath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke("fileExplorer:readFile", filePath),
    /**
     * Securely read file text within a workspace boundary.
     * Enforces path traversal protection, symlink escape prevention,
     * file size limits (2MB), and binary file detection.
     */
    readFileText: (options: {
      filePath: string;
      workspaceRoot: string;
      maxSizeBytes?: number;
    }) => ipcRenderer.invoke("fileExplorer:readFileText", options),
    /**
     * List directory contents for lazy loading.
     * Returns immediate children with hasChildren flag for directories.
     */
    listDir: (options: {
      dirPath: string;
      includeHidden?: boolean;
      excludePatterns?: string[];
    }) => ipcRenderer.invoke("fileExplorer:listDir", options),
  },
  // Git operations
  git: {
    /**
     * Check if a path is a git repository
     */
    isRepo: (rootPath: string) => ipcRenderer.invoke("git:isRepo", rootPath),
    /**
     * Get the current branch name
     */
    getCurrentBranch: (rootPath: string) =>
      ipcRenderer.invoke("git:getCurrentBranch", rootPath),
    /**
     * Get all branches
     */
    getBranches: (rootPath: string) =>
      ipcRenderer.invoke("git:getBranches", rootPath),
    /**
     * Get git status (modified, staged, untracked files, etc.)
     */
    getStatus: (rootPath: string) =>
      ipcRenderer.invoke("git:getStatus", rootPath),
    /**
     * Get recent commits
     */
    getLog: (rootPath: string, limit?: number) =>
      ipcRenderer.invoke("git:getLog", rootPath, limit),
    /**
     * Get remote URLs
     */
    getRemotes: (rootPath: string) =>
      ipcRenderer.invoke("git:getRemotes", rootPath),
    /**
     * Get diff for a file or all files
     */
    getDiff: (rootPath: string, filePath?: string) =>
      ipcRenderer.invoke("git:getDiff", rootPath, filePath),
    /**
     * Get the root directory of the git repository
     */
    getRepoRoot: (rootPath: string) =>
      ipcRenderer.invoke("git:getRepoRoot", rootPath),
    /**
     * Create a new local branch
     */
    createBranch: (rootPath: string, branchName: string) =>
      ipcRenderer.invoke("git:createBranch", rootPath, branchName),
    /**
     * Create a worktree for a branch
     */
    createWorktree: (rootPath: string, worktreePath: string, branchName: string) =>
      ipcRenderer.invoke("git:createWorktree", rootPath, worktreePath, branchName),
    /**
     * Import a local git repo by creating a branch + worktree.
     * Returns full metadata needed for workspace creation.
     */
    importLocalRepo: (sourcePath: string) =>
      ipcRenderer.invoke("git:importLocalRepo", sourcePath),
    /**
     * Remove a worktree
     */
    removeWorktree: (sourcePath: string, worktreePath: string) =>
      ipcRenderer.invoke("git:removeWorktree", sourcePath, worktreePath),
    /**
     * Get the worktrees directory path
     */
    getWorktreesDir: () => ipcRenderer.invoke("git:getWorktreesDir"),
  },
  // Terminal operations
  terminal: {
    create: (payload: { id: string; cwd: string }) =>
      ipcRenderer.invoke("terminal:create", payload),
    write: (id: string, data: string) =>
      ipcRenderer.invoke("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke("terminal:destroy", id),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const listener = (_: any, data: { id: string; data: string }) =>
        callback(data);
      ipcRenderer.on("terminal:data", listener);
      return () => ipcRenderer.removeListener("terminal:data", listener);
    },
  },
  platform: {
    homedir: os.homedir(),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
    openPath: (path: string) => ipcRenderer.invoke("shell:openPath", path),
  },
};

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", api);

export type ApiType = typeof api;
