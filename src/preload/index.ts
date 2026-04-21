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
  // Signal operations (error reports, crashes, alerts, feedback)
  signals: {
    getAll: (options?: { source?: string; level?: string; category?: string; state?: string; projectId?: string; limit?: number }) =>
      ipcRenderer.invoke("signals:getAll", options),
    getById: (entityId: string) =>
      ipcRenderer.invoke("signals:getById", entityId),
    create: (payload: unknown) => ipcRenderer.invoke("signals:create", payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke("signals:update", entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke("signals:delete", entityId),
  },
  // Account operations
  account: {
    get: () => ipcRenderer.invoke("account:get"),
    update: (payload: unknown) => ipcRenderer.invoke("account:update", payload),
  },
  // ConnectionStates operations
  connectionStates: {
    getAll: () => ipcRenderer.invoke("connectionStates:getAll"),
    updateById: (
      id: string,
      payload: { isConnected: boolean; connectionId?: string | null },
    ) => ipcRenderer.invoke("connectionStates:updateById", id, payload),
  },
  // Sync operations
  sync: {
    runEntitySync: (provider?: string) => ipcRenderer.invoke("sync:runEntitySync", provider),
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
    getLinearTeams: (connectionId: string) =>
      ipcRenderer.invoke("connections:getLinearTeams", connectionId),
    getJiraProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getJiraProjects", connectionId),
    getAsanaProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getAsanaProjects", connectionId),
    getGitlabProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getGitlabProjects", connectionId),
    getTrelloBoards: (connectionId: string) =>
      ipcRenderer.invoke("connections:getTrelloBoards", connectionId),
    getSentryProjects: (connectionId: string) =>
      ipcRenderer.invoke("connections:getSentryProjects", connectionId),
    getSocketDevOrganizations: (connectionId: string) =>
      ipcRenderer.invoke("connections:getSocketDevOrganizations", connectionId),
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
  },
  // Guards operations (dependency security)
  guards: {
    getActiveGuard: () => ipcRenderer.invoke("guards:getActiveGuard"),
    checkPackage: (pkg: { name: string; version?: string; ecosystem: string }) =>
      ipcRenderer.invoke("guards:checkPackage", pkg),
    checkPackages: (pkgs: Array<{ name: string; version?: string; ecosystem: string }>) =>
      ipcRenderer.invoke("guards:checkPackages", pkgs),
    getPackageScore: (pkg: { name: string; version?: string; ecosystem: string }) =>
      ipcRenderer.invoke("guards:getPackageScore", pkg),
    scanWorkspace: (workspaceId: string, rootPath: string) =>
      ipcRenderer.invoke("guards:scanWorkspace", workspaceId, rootPath),
  },
  // Projects operations
  projects: {
    getAll: () => ipcRenderer.invoke("projects:getAll"),
    getById: (id: string) => ipcRenderer.invoke("projects:getById", id),
    getByAccount: (accountId: string) =>
      ipcRenderer.invoke("projects:getByAccount", accountId),
    findByRemoteOrigin: (accountId: string, remoteOrigin: string) =>
      ipcRenderer.invoke("projects:findByRemoteOrigin", accountId, remoteOrigin),
    findOrCreate: (payload: unknown) =>
      ipcRenderer.invoke("projects:findOrCreate", payload),
    create: (payload: unknown) =>
      ipcRenderer.invoke("projects:create", payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("projects:update", id, payload),
    remove: (id: string) => ipcRenderer.invoke("projects:remove", id),
    delete: (id: string) => ipcRenderer.invoke("projects:delete", id),
    archive: (id: string) => ipcRenderer.invoke("projects:archive", id),
  },
  // Project Resources operations
  projectResources: {
    getByProject: (projectId: string) =>
      ipcRenderer.invoke("projectResources:getByProject", projectId),
    getAvailable: (projectId: string) =>
      ipcRenderer.invoke("projectResources:getAvailable", projectId),
    add: (payload: { projectId: string; resourceId: string }) =>
      ipcRenderer.invoke("projectResources:add", payload),
    remove: (payload: { projectId: string; resourceId: string }) =>
      ipcRenderer.invoke("projectResources:remove", payload),
    getIssues: (projectId: string) =>
      ipcRenderer.invoke("projectResources:getIssues", projectId),
  },
  // Seed operations
  seed: {
    connectionStates: () => ipcRenderer.invoke("seed:connectionStates"),
    connections: () => ipcRenderer.invoke("seed:connections"),
    all: () => ipcRenderer.invoke("seed:all"),
  },
  // Space operations
  space: {
    getAll: () => ipcRenderer.invoke("space:getAll"),
    getById: (spaceId: string) => ipcRenderer.invoke("space:getById", spaceId),
    create: (payload: unknown) => ipcRenderer.invoke("space:create", payload),
    update: (spaceId: string, payload: unknown) =>
      ipcRenderer.invoke("space:update", spaceId, payload),
    delete: (spaceId: string) => ipcRenderer.invoke("space:delete", spaceId),
    archive: (spaceId: string) => ipcRenderer.invoke("space:archive", spaceId),
    unarchive: (spaceId: string) => ipcRenderer.invoke("space:unarchive", spaceId),
  },
  // App settings operations
  appSettings: {
    get: () => ipcRenderer.invoke("appSettings:get"),
    setActiveSpace: (spaceId: string | null) =>
      ipcRenderer.invoke("appSettings:setActiveSpace", spaceId),
    setEnableWorktrees: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setEnableWorktrees", enabled),
    setShowToolCalls: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setShowToolCalls", enabled),
    setPreventSleepDuringRuns: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setPreventSleepDuringRuns", enabled),
    setNotifyOnRunComplete: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setNotifyOnRunComplete", enabled),
    setNotifyOnToolApproval: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setNotifyOnToolApproval", enabled),
    setShowMenuBarIcon: (enabled: boolean) =>
      ipcRenderer.invoke("appSettings:setShowMenuBarIcon", enabled),
    setCommitInstructions: (instructions: string) =>
      ipcRenderer.invoke("appSettings:setCommitInstructions", instructions),
    setPrInstructions: (instructions: string) =>
      ipcRenderer.invoke("appSettings:setPrInstructions", instructions),
    onSpaceChanged: (
      callback: (data: { activeSpaceId: string | null }) => void,
    ) => {
      const listener = (_: any, data: { activeSpaceId: string | null }) =>
        callback(data);
      ipcRenderer.on("space:changed", listener);
      return () => ipcRenderer.removeListener("space:changed", listener);
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
    getRateLimits: (id: string) => ipcRenderer.invoke("providers:getRateLimits", id),
    getAccountInfo: (id: string) => ipcRenderer.invoke("providers:getAccountInfo", id),
    getPlugins: (id: string) => ipcRenderer.invoke("providers:getPlugins", id),
    readPlugin: (id: string, pluginName: string, marketplacePath: string) => ipcRenderer.invoke("providers:readPlugin", id, pluginName, marketplacePath),
    installPlugin: (id: string, pluginId: string) => ipcRenderer.invoke("providers:installPlugin", id, pluginId),
    uninstallPlugin: (id: string, pluginId: string) => ipcRenderer.invoke("providers:uninstallPlugin", id, pluginId),
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
    onScriptComplete: (callback: (data: { workspaceId: string; script: string; success: boolean; error?: string }) => void) => {
      const listener = (_: any, data: { workspaceId: string; script: string; success: boolean; error?: string }) => callback(data);
      ipcRenderer.on("workspaces:scriptComplete", listener);
      return () => ipcRenderer.removeListener("workspaces:scriptComplete", listener);
    },
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
      spaceId?: string;
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
      attachments?: Array<{ name: string; type: string; data: string; mimeType: string }>;
      contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
      contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
      contextFiles?: Array<{ path: string }>;
    }) => ipcRenderer.invoke("runs:execute", payload),
    abort: (runId: string) => ipcRenderer.invoke("runs:abort", runId),
    getToolCalls: (runId: string) =>
      ipcRenderer.invoke("runToolCalls:getByRun", runId),
    // Session resume methods
    continue: (payload: {
      runId: string;
      accountId: string;
      message: string;
      model?: string;
      additionalContext?: Array<{
        kind: "file" | "diff" | "selection" | "note";
        ref?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }>;
      attachments?: Array<{ name: string; type: string; data: string; mimeType: string }>;
      contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
      contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
      contextFiles?: Array<{ path: string }>;
    }) => ipcRenderer.invoke("runs:continue", payload),
    canResume: (runId: string) => ipcRenderer.invoke("runs:canResume", runId),
    fork: (payload: {
      sourceRunId: string;
      accountId: string;
      message: string;
      additionalContext?: Array<{
        kind: "file" | "diff" | "selection" | "note";
        ref?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }>;
      attachments?: Array<{ name: string; type: string; data: string; mimeType: string }>;
    }) => ipcRenderer.invoke("runs:fork", payload),
    executeReview: (payload: {
      accountId: string;
      workspaceId: string;
      spaceId?: string;
      providerId: string;
      target: {
        type: "uncommittedChanges" | "baseBranch" | "commit" | "custom";
        branch?: string;
        sha?: string;
        title?: string;
        instructions?: string;
      };
      delivery?: "inline" | "detached";
      model?: string;
      systemPrompt?: string;
      configSnapshot?: Record<string, unknown>;
      toolPolicySnapshot?: Record<string, unknown>;
    }) => ipcRenderer.invoke("runs:executeReview", payload),
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
    // Streaming events (ephemeral — pushed from main, not persisted)
    onStreamingEvent: (callback: (data: { runId: string; event: { type: string; kind: string; content?: string; metadata?: Record<string, unknown>; streamId?: string }; ts: number }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on("runs:ephemeralEvent", listener);
      return () => ipcRenderer.removeListener("runs:ephemeralEvent", listener);
    },
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
  // Review findings operations
  reviewFindings: {
    getByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke("reviewFindings:getByWorkspace", workspaceId),
    getByReview: (reviewId: string, limit?: number) =>
      ipcRenderer.invoke("reviewFindings:getByReview", reviewId, limit),
    getById: (id: string) =>
      ipcRenderer.invoke("reviewFindings:getById", id),
    create: (payload: unknown) =>
      ipcRenderer.invoke("reviewFindings:create", payload),
    createMany: (payloads: unknown) =>
      ipcRenderer.invoke("reviewFindings:createMany", payloads),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke("reviewFindings:update", id, payload),
    delete: (id: string) =>
      ipcRenderer.invoke("reviewFindings:delete", id),
  },
  // Workspace diff operations
  workspaceDiffs: {
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke("workspaceDiffs:getByWorkspace", workspaceId, limit),
    getLatest: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceDiffs:getLatest", workspaceId),
    getByRun: (runId: string) =>
      ipcRenderer.invoke("workspaceDiffs:getByRun", runId),
    deleteLatest: (workspaceId: string) =>
      ipcRenderer.invoke("workspaceDiffs:deleteLatest", workspaceId),
  },
  // Workspace activity operations
  workspaceActivity: {
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke("workspaceActivity:getByWorkspace", workspaceId, limit),
    create: (payload: unknown) =>
      ipcRenderer.invoke("workspaceActivity:create", payload),
    createMany: (payloads: unknown) =>
      ipcRenderer.invoke("workspaceActivity:createMany", payloads),
    delete: (id: string) =>
      ipcRenderer.invoke("workspaceActivity:delete", id),
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
  // Run turns operations
  runTurns: {
    getByRun: (runId: string) => ipcRenderer.invoke("runTurns:getByRun", runId),
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
    importLocalRepo: (sourcePath: string, projectName?: string, customBranchName?: string) =>
      ipcRenderer.invoke("git:importLocalRepo", sourcePath, projectName, customBranchName),
    importLocalRepoDirect: (sourcePath: string) =>
      ipcRenderer.invoke("git:importLocalRepoDirect", sourcePath),
    /**
     * Rename a local branch
     */
    renameBranch: (rootPath: string, oldName: string, newName: string) =>
      ipcRenderer.invoke("git:renameBranch", rootPath, oldName, newName),
    /**
     * Remove a worktree
     */
    removeWorktree: (sourcePath: string, worktreePath: string) =>
      ipcRenderer.invoke("git:removeWorktree", sourcePath, worktreePath),
    /**
     * Get the worktrees directory path
     */
    getWorktreesDir: () => ipcRenderer.invoke("git:getWorktreesDir"),
    /**
     * Clone a remote git repository to a local path
     */
    cloneRepo: (url: string, targetPath: string) =>
      ipcRenderer.invoke("git:cloneRepo", url, targetPath),
    /**
     * Hard-reset working tree to a given ref and clean untracked files
     */
    resetHard: (rootPath: string, ref: string) =>
      ipcRenderer.invoke("git:resetHard", rootPath, ref),
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
    openInApp: (appId: string, path: string) => ipcRenderer.invoke("shell:openInApp", appId, path),
    getInstalledApps: () => ipcRenderer.invoke("shell:getInstalledApps"),
  },
  stats: {
    getDashboard: (filter?: string) => ipcRenderer.invoke("stats:getDashboard", filter),
  },
  app: {
    setUnsavedChanges: (hasChanges: boolean) =>
      ipcRenderer.invoke("app:setUnsavedChanges", hasChanges),
    setMenuBarIconVisible: (visible: boolean) =>
      ipcRenderer.invoke("app:setMenuBarIconVisible", visible),
    onFlushAndQuit: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("app:flushAndQuit", listener);
      return () => ipcRenderer.removeListener("app:flushAndQuit", listener);
    },
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_: any, isFullscreen: boolean) => callback(isFullscreen);
      ipcRenderer.on("app:fullscreenChange", listener);
      return () => {
        ipcRenderer.removeListener("app:fullscreenChange", listener);
      };
    },
  },
  updates: {
    checkForUpdates: () => ipcRenderer.invoke("updates:check"),
    downloadUpdate: () => ipcRenderer.invoke("updates:download"),
    quitAndInstall: () => ipcRenderer.invoke("updates:quitAndInstall"),
    getStatus: () => ipcRenderer.invoke("updates:getStatus"),
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on("updates:status", listener);
      return () => ipcRenderer.removeListener("updates:status", listener);
    },
  },

  // Automation operations (scheduled jobs)
  automations: {
    getAll: () => ipcRenderer.invoke("automations:getAll"),
    getById: (id: string) => ipcRenderer.invoke("automations:getById", id),
    create: (accountId: string, input: unknown) =>
      ipcRenderer.invoke("automations:create", accountId, input),
    update: (id: string, input: unknown) =>
      ipcRenderer.invoke("automations:update", id, input),
    delete: (id: string) => ipcRenderer.invoke("automations:delete", id),
    execute: (id: string) => ipcRenderer.invoke("automations:execute", id),
    getRunHistory: (automationId: string, limit?: number) =>
      ipcRenderer.invoke("automations:getRunHistory", automationId, limit),
    getAvailableActions: () => ipcRenderer.invoke("automations:getAvailableActions"),
  },
};

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", api);

export type ApiType = typeof api;
