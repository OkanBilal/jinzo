import { contextBridge, ipcRenderer } from "electron";
import os from "node:os";
import { CHANNELS } from "../shared/ipc-kit/channels";

// Expose IPC methods to renderer process
const api = {
  // Entity operations (canonical content)
  entities: {
    getAll: (options?: {
      kind?: string;
      connectionId?: string;
      limit?: number;
    }) => ipcRenderer.invoke(CHANNELS.entities.getAll, options),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.entities.getById, id),
    create: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.entities.create, payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.entities.update, id, payload),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.entities.delete, id),
    search: (query: string, options?: { kind?: string; limit?: number }) =>
      ipcRenderer.invoke(CHANNELS.entities.search, query, options),
  },
  // Task operations (actionable domain)
  tasks: {
    getAll: (options?: { status?: string; limit?: number }) =>
      ipcRenderer.invoke(CHANNELS.tasks.getAll, options),
    getById: (entityId: string) =>
      ipcRenderer.invoke(CHANNELS.tasks.getById, entityId),
    create: (payload: unknown) => ipcRenderer.invoke(CHANNELS.tasks.create, payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.tasks.update, entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke(CHANNELS.tasks.delete, entityId),
  },
  // Issue operations (actionable domain)
  issues: {
    getAll: (options?: { provider?: string; state?: string; repo?: string; limit?: number }) =>
      ipcRenderer.invoke(CHANNELS.issues.getAll, options),
    getById: (entityId: string) =>
      ipcRenderer.invoke(CHANNELS.issues.getById, entityId),
    create: (payload: unknown) => ipcRenderer.invoke(CHANNELS.issues.create, payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.issues.update, entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke(CHANNELS.issues.delete, entityId),
  },
  // Signal operations (error reports, crashes, alerts, feedback)
  signals: {
    getAll: (options?: { source?: string; level?: string; category?: string; state?: string; projectId?: string; limit?: number }) =>
      ipcRenderer.invoke(CHANNELS.signals.getAll, options),
    getById: (entityId: string) =>
      ipcRenderer.invoke(CHANNELS.signals.getById, entityId),
    create: (payload: unknown) => ipcRenderer.invoke(CHANNELS.signals.create, payload),
    update: (entityId: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.signals.update, entityId, payload),
    delete: (entityId: string) => ipcRenderer.invoke(CHANNELS.signals.delete, entityId),
  },
  // Account operations
  account: {
    get: () => ipcRenderer.invoke(CHANNELS.account.get),
    update: (payload: unknown) => ipcRenderer.invoke(CHANNELS.account.update, payload),
  },
  // Sync operations
  sync: {
    runEntitySync: (provider?: string) => ipcRenderer.invoke(CHANNELS.sync.runEntitySync, provider),
  },
  // Connections aggregate (identity + tokens + states). See ADR-0002.
  connections: {
    // ── integration-state list (Settings page) ──
    listStates: () => ipcRenderer.invoke(CHANNELS.connections.listStates),
    updateState: (
      id: string,
      payload: { isConnected: boolean; connectionId?: string | null },
    ) => ipcRenderer.invoke(CHANNELS.connections.updateState, id, payload),
    // ── credentials ──
    saveCredentials: (payload: {
      provider: string;
      connectionId: string;
      [key: string]: any;
    }) => ipcRenderer.invoke(CHANNELS.connections.saveCredentials, payload),
    checkCredentials: (provider: string) =>
      ipcRenderer.invoke(CHANNELS.connections.checkCredentials, provider),
    // ── identity + resource discovery ──
    getByProvider: (provider: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getByProvider, provider),
    revoke: (provider: string) =>
      ipcRenderer.invoke(CHANNELS.connections.revoke, provider),
    getGithubRepos: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getGithubRepos, connectionId),
    getLinearTeams: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getLinearTeams, connectionId),
    getJiraProjects: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getJiraProjects, connectionId),
    getAsanaProjects: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getAsanaProjects, connectionId),
    getGitlabProjects: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getGitlabProjects, connectionId),
    getTrelloBoards: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getTrelloBoards, connectionId),
    getSentryProjects: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getSentryProjects, connectionId),
    getSocketDevOrganizations: (connectionId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getSocketDevOrganizations, connectionId),
    saveResources: (payload: {
      provider: string;
      connectionId: string;
      resources?: any[];
      sources?: string[];
    }) => ipcRenderer.invoke(CHANNELS.connections.saveResources, payload),
    deleteResource: (resourceId: string) =>
      ipcRenderer.invoke(CHANNELS.connections.deleteResource, resourceId),
    getSelectedResources: (provider: string) =>
      ipcRenderer.invoke(CHANNELS.connections.getSelectedResources, provider),
  },
  // Guards operations (dependency security)
  guards: {
    getActiveGuard: () => ipcRenderer.invoke(CHANNELS.guards.getActiveGuard),
    checkPackage: (pkg: { name: string; version?: string; ecosystem: string }) =>
      ipcRenderer.invoke(CHANNELS.guards.checkPackage, pkg),
    checkPackages: (pkgs: Array<{ name: string; version?: string; ecosystem: string }>) =>
      ipcRenderer.invoke(CHANNELS.guards.checkPackages, pkgs),
    getPackageScore: (pkg: { name: string; version?: string; ecosystem: string }) =>
      ipcRenderer.invoke(CHANNELS.guards.getPackageScore, pkg),
    scanWorkspace: (workspaceId: string, rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.guards.scanWorkspace, workspaceId, rootPath),
  },
  // Projects operations (incl. project_resources + linked-issue queries)
  projects: {
    // ── lifecycle ──
    list: () => ipcRenderer.invoke(CHANNELS.projects.list),
    get: (id: string) => ipcRenderer.invoke(CHANNELS.projects.get, id),
    listByAccount: (accountId: string) =>
      ipcRenderer.invoke(CHANNELS.projects.listByAccount, accountId),
    findByRemoteOrigin: (accountId: string, remoteOrigin: string) =>
      ipcRenderer.invoke(CHANNELS.projects.findByRemoteOrigin, accountId, remoteOrigin),
    findOrCreate: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.projects.findOrCreate, payload),
    create: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.projects.create, payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.projects.update, id, payload),
    remove: (id: string) => ipcRenderer.invoke(CHANNELS.projects.remove, id),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.projects.delete, id),
    archive: (id: string) => ipcRenderer.invoke(CHANNELS.projects.archive, id),
    // ── resources ──
    listResources: (projectId: string) =>
      ipcRenderer.invoke(CHANNELS.projects.listResources, projectId),
    listAvailableResources: (projectId: string) =>
      ipcRenderer.invoke(CHANNELS.projects.listAvailableResources, projectId),
    addResource: (payload: { projectId: string; resourceId: string }) =>
      ipcRenderer.invoke(CHANNELS.projects.addResource, payload),
    removeResource: (payload: { projectId: string; resourceId: string }) =>
      ipcRenderer.invoke(CHANNELS.projects.removeResource, payload),
    // ── issues (via linked resources) ──
    listIssues: (projectId: string) =>
      ipcRenderer.invoke(CHANNELS.projects.listIssues, projectId),
  },
  // Space operations
  space: {
    getAll: () => ipcRenderer.invoke(CHANNELS.space.getAll),
    getById: (spaceId: string) => ipcRenderer.invoke(CHANNELS.space.getById, spaceId),
    create: (payload: unknown) => ipcRenderer.invoke(CHANNELS.space.create, payload),
    update: (spaceId: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.space.update, spaceId, payload),
    delete: (spaceId: string) => ipcRenderer.invoke(CHANNELS.space.delete, spaceId),
    archive: (spaceId: string) => ipcRenderer.invoke(CHANNELS.space.archive, spaceId),
    unarchive: (spaceId: string) => ipcRenderer.invoke(CHANNELS.space.unarchive, spaceId),
  },
  // App settings operations
  appSettings: {
    get: () => ipcRenderer.invoke(CHANNELS.appSettings.get),
    update: (patch: Record<string, unknown>) =>
      ipcRenderer.invoke(CHANNELS.appSettings.update, patch),
    onSpaceChanged: (
      callback: (data: { activeSpaceId: string | null }) => void,
    ) => {
      const listener = (_: any, data: { activeSpaceId: string | null }) =>
        callback(data);
      ipcRenderer.on(CHANNELS.space.changed, listener);
      return () => ipcRenderer.removeListener(CHANNELS.space.changed, listener);
    },
  },
  // Provider operations
  providers: {
    getAll: () => ipcRenderer.invoke(CHANNELS.providers.getAll),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.providers.getById, id),
    getByKind: (kind: "llm_runtime" | "agent_runtime") =>
      ipcRenderer.invoke(CHANNELS.providers.getByKind, kind),
    getEnabled: () => ipcRenderer.invoke(CHANNELS.providers.getEnabled),
    create: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.providers.create, payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.providers.update, id, payload),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.providers.delete, id),
    enable: (id: string) => ipcRenderer.invoke(CHANNELS.providers.enable, id),
    disable: (id: string) => ipcRenderer.invoke(CHANNELS.providers.disable, id),
    getModels: (id: string) => ipcRenderer.invoke(CHANNELS.providers.getModels, id),
    getCommands: (id: string, workspacePath?: string) =>
      ipcRenderer.invoke(CHANNELS.providers.getCommands, id, workspacePath),
    getSkills: (id: string, workspacePath?: string) => ipcRenderer.invoke(CHANNELS.providers.getSkills, id, workspacePath),
    getRateLimits: (id: string) => ipcRenderer.invoke(CHANNELS.providers.getRateLimits, id),
    getAccountInfo: (id: string) => ipcRenderer.invoke(CHANNELS.providers.getAccountInfo, id),
    getPlugins: (id: string) => ipcRenderer.invoke(CHANNELS.providers.getPlugins, id),
    readPlugin: (id: string, pluginName: string, marketplacePath: string) => ipcRenderer.invoke(CHANNELS.providers.readPlugin, id, pluginName, marketplacePath),
    installPlugin: (id: string, pluginId: string) => ipcRenderer.invoke(CHANNELS.providers.installPlugin, id, pluginId),
    uninstallPlugin: (id: string, pluginId: string) => ipcRenderer.invoke(CHANNELS.providers.uninstallPlugin, id, pluginId),
    detectInstalled: () => ipcRenderer.invoke(CHANNELS.providers.detectInstalled),
  },
  // Tool calls operations
  toolCalls: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.getByRun, runId),
    getByAccount: (accountId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.getByAccount, accountId, limit),
    create: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.create, payload),
    update: (id: number, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.update, id, payload),
    start: (id: number) => ipcRenderer.invoke(CHANNELS.toolCalls.start, id),
    complete: (id: number, output: unknown, latencyMs?: number) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.complete, id, output, latencyMs),
    fail: (id: number, error: string) =>
      ipcRenderer.invoke(CHANNELS.toolCalls.fail, id, error),
  },
  // Workspace aggregate (workspaces + activity + diffs + reviews + findings)
  // See ADR-0001. Old per-table namespaces below are retained through Phase 3
  // of the consolidation and will be removed once renderer migration completes.
  workspace: {
    // ── lifecycle ──
    list: () => ipcRenderer.invoke(CHANNELS.workspace.list),
    get: (id: string) => ipcRenderer.invoke(CHANNELS.workspace.get, id),
    listByAccount: (accountId: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.listByAccount, accountId),
    getByRootPath: (accountId: string, rootPath: string) =>
      ipcRenderer.invoke(
        CHANNELS.workspace.getByRootPath,
        accountId,
        rootPath,
      ),
    create: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.create, payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.update, id, payload),
    delete: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.delete, id),
    archive: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.archive, id),
    selectDirectory: () =>
      ipcRenderer.invoke(CHANNELS.workspace.selectDirectory),
    onScriptComplete: (
      callback: (data: {
        workspaceId: string;
        script: "setup" | "archive";
        success: boolean;
        error?: string;
      }) => void,
    ) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.workspace.scriptComplete, listener);
      return () =>
        ipcRenderer.removeListener(CHANNELS.workspace.scriptComplete, listener);
    },
    onFindingsChanged: (
      callback: (data: { workspaceId: string }) => void,
    ) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.workspace.findingsChanged, listener);
      return () =>
        ipcRenderer.removeListener(
          CHANNELS.workspace.findingsChanged,
          listener,
        );
    },
    // ── activity ──
    listActivity: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.workspace.listActivity, workspaceId, limit),
    createActivity: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.createActivity, payload),
    createManyActivity: (payloads: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.createManyActivity, payloads),
    deleteActivity: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.deleteActivity, id),
    // ── diffs ──
    listDiffs: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.workspace.listDiffs, workspaceId, limit),
    getLatestDiff: (workspaceId: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.getLatestDiff, workspaceId),
    getLatestDiffSummary: (workspaceId: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.getLatestDiffSummary, workspaceId),
    getDiffByRun: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.getDiffByRun, runId),
    deleteLatestDiff: (workspaceId: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.deleteLatestDiff, workspaceId),
    // ── reviews ──
    listReviews: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.workspace.listReviews, workspaceId, limit),
    getReview: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.getReview, id),
    createReview: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.createReview, payload),
    updateReview: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.updateReview, id, payload),
    deleteReview: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.deleteReview, id),
    // ── findings ──
    listFindings: (reviewId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.workspace.listFindings, reviewId, limit),
    listFindingsByWorkspace: (workspaceId: string) =>
      ipcRenderer.invoke(
        CHANNELS.workspace.listFindingsByWorkspace,
        workspaceId,
      ),
    getFinding: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.getFinding, id),
    createFinding: (payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.createFinding, payload),
    createManyFindings: (payloads: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.createManyFindings, payloads),
    updateFinding: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.workspace.updateFinding, id, payload),
    deleteFinding: (id: string) =>
      ipcRenderer.invoke(CHANNELS.workspace.deleteFinding, id),
  },
  // Runs operations
  runs: {
    getAll: (limit?: number) => ipcRenderer.invoke(CHANNELS.runs.getAll, limit),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.runs.getById, id),
    getByAccount: (accountId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.runs.getByAccount, accountId, limit),
    getByWorkspace: (workspaceId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.runs.getByWorkspace, workspaceId, limit),
    getByStatus: (
      accountId: string,
      status: "queued" | "running" | "succeeded" | "failed" | "canceled",
    ) => ipcRenderer.invoke(CHANNELS.runs.getByStatus, accountId, status),
    create: (payload: unknown) => ipcRenderer.invoke(CHANNELS.runs.create, payload),
    update: (id: string, payload: unknown) =>
      ipcRenderer.invoke(CHANNELS.runs.update, id, payload),
    start: (id: string) => ipcRenderer.invoke(CHANNELS.runs.start, id),
    complete: (id: string) => ipcRenderer.invoke(CHANNELS.runs.complete, id),
    fail: (id: string, error: string) =>
      ipcRenderer.invoke(CHANNELS.runs.fail, id, error),
    cancel: (id: string) => ipcRenderer.invoke(CHANNELS.runs.cancel, id),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.runs.delete, id),
    archive: (id: string) => ipcRenderer.invoke(CHANNELS.runs.archive, id),
    // New methods for executing work runs
    getDetails: (runId: string) => ipcRenderer.invoke(CHANNELS.runs.getDetails, runId),
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
      attachments?: Array<{ name: string; type: string; data?: string; sourcePath?: string; mimeType: string }>;
      contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
      contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
      contextFiles?: Array<{ path: string }>;
      contextSkills?: Array<{ name: string; path?: string; displayName?: string; description?: string; shortDescription?: string; iconSmall?: string; iconLarge?: string; brandColor?: string; scope?: string }>;
    }) => ipcRenderer.invoke(CHANNELS.runs.execute, payload),
    abort: (runId: string) => ipcRenderer.invoke(CHANNELS.runs.abort, runId),
    getToolCalls: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.runToolCalls.getByRun, runId),
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
      attachments?: Array<{ name: string; type: string; data?: string; sourcePath?: string; mimeType: string }>;
      contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
      contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
      contextFiles?: Array<{ path: string }>;
      contextSkills?: Array<{ name: string; path?: string; displayName?: string; description?: string; shortDescription?: string; iconSmall?: string; iconLarge?: string; brandColor?: string; scope?: string }>;
    }) => ipcRenderer.invoke(CHANNELS.runs.continue, payload),
    canResume: (runId: string) => ipcRenderer.invoke(CHANNELS.runs.canResume, runId),
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
      attachments?: Array<{ name: string; type: string; data?: string; sourcePath?: string; mimeType: string }>;
    }) => ipcRenderer.invoke(CHANNELS.runs.fork, payload),
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
    }) => ipcRenderer.invoke(CHANNELS.runs.executeReview, payload),
    deleteSession: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.runs.deleteSession, runId),
    // Interactive tool approval
    onToolApprovalRequest: (callback: (request: any) => void) => {
      const listener = (_: any, request: any) => callback(request);
      ipcRenderer.on(CHANNELS.runs.toolApprovalRequest, listener);
      return () =>
        ipcRenderer.removeListener(CHANNELS.runs.toolApprovalRequest, listener);
    },
    respondToolApproval: (response: {
      requestId: string;
      approved: boolean;
      answer?: string;
    }) => ipcRenderer.invoke(CHANNELS.runs.toolApprovalResponse, response),
    // Streaming events (ephemeral — pushed from main, not persisted)
    onStreamingEvent: (callback: (data: { runId: string; event: { type: string; kind: string; content?: string; metadata?: Record<string, unknown>; streamId?: string }; ts: number }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.runs.ephemeralEvent, listener);
      return () => ipcRenderer.removeListener(CHANNELS.runs.ephemeralEvent, listener);
    },
    // Fired after each persisted run event (log / tool_call / artifact / prompt_suggestion).
    // Renderer debounces and refetches run details — keeps the UI in sync without polling.
    onEventPersisted: (callback: (data: { runId: string; ts: number }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.runs.eventPersisted, listener);
      return () => ipcRenderer.removeListener(CHANNELS.runs.eventPersisted, listener);
    },
    // Fired when a run reaches a terminal status (succeeded / failed / canceled).
    onStatusChanged: (callback: (data: { runId: string; status: string; ts: number }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.runs.statusChanged, listener);
      return () => ipcRenderer.removeListener(CHANNELS.runs.statusChanged, listener);
    },
    // Fired after the workspace diff is recomputed (incrementally during a run
    // and once finally at completion). Renderer refetches the diff.
    onDiffUpdated: (callback: (data: { runId: string; workspaceId: string; ts: number }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.runs.diffUpdated, listener);
      return () => ipcRenderer.removeListener(CHANNELS.runs.diffUpdated, listener);
    },
  },
  // Run context operations
  runContext: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.runContext.getByRun, runId),
    add: (payload: unknown) => ipcRenderer.invoke(CHANNELS.runContext.add, payload),
    remove: (id: number) => ipcRenderer.invoke(CHANNELS.runContext.remove, id),
  },
  // Run artifacts operations
  runArtifacts: {
    getByRun: (runId: string) =>
      ipcRenderer.invoke(CHANNELS.runArtifacts.getByRun, runId),
    add: (payload: unknown) => ipcRenderer.invoke(CHANNELS.runArtifacts.add, payload),
    remove: (id: number) => ipcRenderer.invoke(CHANNELS.runArtifacts.remove, id),
  },
  // Run turns operations
  runTurns: {
    getByRun: (runId: string) => ipcRenderer.invoke(CHANNELS.runTurns.getByRun, runId),
  },
  // File explorer operations
  fileExplorer: {
    readDirectory: (options: {
      rootPath: string;
      depth?: number;
      includeHidden?: boolean;
      excludePatterns?: string[];
    }) => ipcRenderer.invoke(CHANNELS.fileExplorer.readDirectory, options),
    readDirectoryShallow: (
      dirPath: string,
      options?: { includeHidden?: boolean; excludePatterns?: string[] }
    ) => ipcRenderer.invoke(CHANNELS.fileExplorer.readDirectoryShallow, dirPath, options),
    getPathInfo: (targetPath: string) =>
      ipcRenderer.invoke(CHANNELS.fileExplorer.getPathInfo, targetPath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke(CHANNELS.fileExplorer.readFile, filePath),
    /**
     * Read file text. Enforces regular-file, 2MB size limit, and binary
     * detection. No workspace boundary — the agent already has full
     * filesystem access so the renderer can preview anywhere.
     */
    readFileText: (options: {
      filePath: string;
      maxSizeBytes?: number;
    }) => ipcRenderer.invoke(CHANNELS.fileExplorer.readFileText, options),
    /**
     * List directory contents for lazy loading.
     * Returns immediate children with hasChildren flag for directories.
     */
    listDir: (options: {
      dirPath: string;
      includeHidden?: boolean;
      excludePatterns?: string[];
    }) => ipcRenderer.invoke(CHANNELS.fileExplorer.listDir, options),
    searchFiles: (options: {
      rootPath: string;
      query: string;
      max?: number;
      includeHidden?: boolean;
      excludePatterns?: string[];
    }) => ipcRenderer.invoke(CHANNELS.fileExplorer.searchFiles, options),
  },
  // Git operations
  git: {
    /**
     * Check if a path is a git repository
     */
    isRepo: (rootPath: string) => ipcRenderer.invoke(CHANNELS.git.isRepo, rootPath),
    /**
     * Get the current branch name
     */
    getCurrentBranch: (rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.getCurrentBranch, rootPath),
    /**
     * Get all branches
     */
    getBranches: (rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.getBranches, rootPath),
    /**
     * Get git status (modified, staged, untracked files, etc.)
     */
    getStatus: (rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.getStatus, rootPath),
    /**
     * Get recent commits
     */
    getLog: (rootPath: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.git.getLog, rootPath, limit),
    /**
     * Get remote URLs
     */
    getRemotes: (rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.getRemotes, rootPath),
    /**
     * Get diff for a file or all files
     */
    getDiff: (rootPath: string, filePath?: string) =>
      ipcRenderer.invoke(CHANNELS.git.getDiff, rootPath, filePath),
    /**
     * Get the root directory of the git repository
     */
    getRepoRoot: (rootPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.getRepoRoot, rootPath),
    /**
     * Create a new local branch
     */
    createBranch: (rootPath: string, branchName: string) =>
      ipcRenderer.invoke(CHANNELS.git.createBranch, rootPath, branchName),
    /**
     * Create a worktree for a branch
     */
    createWorktree: (rootPath: string, worktreePath: string, branchName: string) =>
      ipcRenderer.invoke(CHANNELS.git.createWorktree, rootPath, worktreePath, branchName),
    /**
     * Import a local git repo by creating a branch + worktree.
     * Returns full metadata needed for workspace creation.
     */
    importLocalRepo: (sourcePath: string, projectName?: string, customBranchName?: string) =>
      ipcRenderer.invoke(CHANNELS.git.importLocalRepo, sourcePath, projectName, customBranchName),
    importLocalRepoDirect: (sourcePath: string) =>
      ipcRenderer.invoke(CHANNELS.git.importLocalRepoDirect, sourcePath),
    /**
     * Rename a local branch
     */
    renameBranch: (rootPath: string, oldName: string, newName: string) =>
      ipcRenderer.invoke(CHANNELS.git.renameBranch, rootPath, oldName, newName),
    /**
     * Remove a worktree
     */
    removeWorktree: (sourcePath: string, worktreePath: string) =>
      ipcRenderer.invoke(CHANNELS.git.removeWorktree, sourcePath, worktreePath),
    /**
     * Get the worktrees directory path
     */
    getWorktreesDir: () => ipcRenderer.invoke(CHANNELS.git.getWorktreesDir),
    /**
     * Clone a remote git repository to a local path
     */
    cloneRepo: (url: string, targetPath: string) =>
      ipcRenderer.invoke(CHANNELS.git.cloneRepo, url, targetPath),
    /**
     * Initialize a new git repo in a fresh folder under parentPath
     * (defaults to user Desktop). Always uses `main` as the branch.
     */
    initRepo: (projectName: string, parentPath?: string) =>
      ipcRenderer.invoke(CHANNELS.git.initRepo, projectName, parentPath),
    /**
     * Hard-reset working tree to a given ref and clean untracked files
     */
    resetHard: (rootPath: string, ref: string) =>
      ipcRenderer.invoke(CHANNELS.git.resetHard, rootPath, ref),
  },
  // Terminal operations
  terminal: {
    create: (payload: { id: string; cwd: string }) =>
      ipcRenderer.invoke(CHANNELS.terminal.create, payload),
    write: (id: string, data: string) =>
      ipcRenderer.invoke(CHANNELS.terminal.write, id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke(CHANNELS.terminal.resize, id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke(CHANNELS.terminal.destroy, id),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const listener = (_: any, data: { id: string; data: string }) =>
        callback(data);
      ipcRenderer.on(CHANNELS.terminal.data, listener);
      return () => ipcRenderer.removeListener(CHANNELS.terminal.data, listener);
    },
  },
  platform: {
    homedir: os.homedir(),
  },
  imageProxy: {
    sign: (absPath: string) => ipcRenderer.invoke(CHANNELS.imageProxy.sign, absPath),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.shell.openExternal, url),
    openPath: (path: string) => ipcRenderer.invoke(CHANNELS.shell.openPath, path),
    openInApp: (appId: string, path: string) => ipcRenderer.invoke(CHANNELS.shell.openInApp, appId, path),
    getInstalledApps: () => ipcRenderer.invoke(CHANNELS.shell.getInstalledApps),
    getAppsForFile: (filePath: string) =>
      ipcRenderer.invoke(CHANNELS.shell.getAppsForFile, filePath),
    openFileWithBundle: (filePath: string, bundleId: string) =>
      ipcRenderer.invoke(CHANNELS.shell.openFileWithBundle, filePath, bundleId),
  },
  stats: {
    getDashboard: (filter?: string) => ipcRenderer.invoke(CHANNELS.stats.getDashboard, filter),
  },
  app: {
    setUnsavedChanges: (hasChanges: boolean) =>
      ipcRenderer.invoke(CHANNELS.app.setUnsavedChanges, hasChanges),
    setMenuBarIconVisible: (visible: boolean) =>
      ipcRenderer.invoke(CHANNELS.app.setMenuBarIconVisible, visible),
    onFlushAndQuit: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(CHANNELS.app.flushAndQuit, listener);
      return () => ipcRenderer.removeListener(CHANNELS.app.flushAndQuit, listener);
    },
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
      const listener = (_: any, isFullscreen: boolean) => callback(isFullscreen);
      ipcRenderer.on(CHANNELS.app.fullscreenChange, listener);
      return () => {
        ipcRenderer.removeListener(CHANNELS.app.fullscreenChange, listener);
      };
    },
  },
  updates: {
    checkForUpdates: () => ipcRenderer.invoke(CHANNELS.updates.check),
    downloadUpdate: () => ipcRenderer.invoke(CHANNELS.updates.download),
    quitAndInstall: () => ipcRenderer.invoke(CHANNELS.updates.quitAndInstall),
    getStatus: () => ipcRenderer.invoke(CHANNELS.updates.getStatus),
    onStatusChange: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.updates.status, listener);
      return () => ipcRenderer.removeListener(CHANNELS.updates.status, listener);
    },
  },

  // Embedded browser panel operations
  browser: {
    attach: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke(CHANNELS.browser.attach, bounds),
    detach: () => ipcRenderer.invoke(CHANNELS.browser.detach),
    destroy: () => ipcRenderer.invoke(CHANNELS.browser.destroy),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
      ipcRenderer.invoke(CHANNELS.browser.setBounds, bounds),
    setVisible: (visible: boolean) =>
      ipcRenderer.invoke(CHANNELS.browser.setVisible, visible),
    navigate: (url: string) => ipcRenderer.invoke(CHANNELS.browser.navigate, url),
    back: () => ipcRenderer.invoke(CHANNELS.browser.back),
    forward: () => ipcRenderer.invoke(CHANNELS.browser.forward),
    reload: () => ipcRenderer.invoke(CHANNELS.browser.reload),
    stop: () => ipcRenderer.invoke(CHANNELS.browser.stop),
    setSelectMode: (enabled: boolean) =>
      ipcRenderer.invoke(CHANNELS.browser.setSelectMode, enabled),
    getNavState: () => ipcRenderer.invoke(CHANNELS.browser.getNavState),
    /** Remove a browser capture PNG from userData/browser-captures. Pass the basename only. */
    deleteCapture: (captureName: string) =>
      ipcRenderer.invoke(CHANNELS.browser.deleteCapture, captureName),
    onNavState: (
      callback: (state: {
        url: string;
        title: string;
        canGoBack: boolean;
        canGoForward: boolean;
        isLoading: boolean;
      }) => void,
    ) => {
      const listener = (_: any, state: any) => callback(state);
      ipcRenderer.on(CHANNELS.browser.navState, listener);
      return () => ipcRenderer.removeListener(CHANNELS.browser.navState, listener);
    },
    onSelectModeChanged: (callback: (data: { enabled: boolean }) => void) => {
      const listener = (_: any, data: any) => callback(data);
      ipcRenderer.on(CHANNELS.browser.selectModeChanged, listener);
      return () =>
        ipcRenderer.removeListener(CHANNELS.browser.selectModeChanged, listener);
    },
    onSelection: (callback: (selection: any) => void) => {
      const listener = (_: any, selection: any) => callback(selection);
      ipcRenderer.on(CHANNELS.browser.selection, listener);
      return () => ipcRenderer.removeListener(CHANNELS.browser.selection, listener);
    },
  },

  // Automation operations (scheduled jobs)
  automations: {
    getAll: () => ipcRenderer.invoke(CHANNELS.automations.getAll),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.automations.getById, id),
    create: (accountId: string, input: unknown) =>
      ipcRenderer.invoke(CHANNELS.automations.create, accountId, input),
    update: (id: string, input: unknown) =>
      ipcRenderer.invoke(CHANNELS.automations.update, id, input),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.automations.delete, id),
    execute: (id: string) => ipcRenderer.invoke(CHANNELS.automations.execute, id),
    getRunHistory: (automationId: string, limit?: number) =>
      ipcRenderer.invoke(CHANNELS.automations.getRunHistory, automationId, limit),
    getAvailableActions: () => ipcRenderer.invoke(CHANNELS.automations.getAvailableActions),
  },

  // Pulse operations (scheduled work runs)
  pulse: {
    getAll: () => ipcRenderer.invoke(CHANNELS.pulse.getAll),
    getById: (id: string) => ipcRenderer.invoke(CHANNELS.pulse.getById, id),
    create: (accountId: string, input: unknown) =>
      ipcRenderer.invoke(CHANNELS.pulse.create, accountId, input),
    update: (id: string, input: unknown) =>
      ipcRenderer.invoke(CHANNELS.pulse.update, id, input),
    delete: (id: string) => ipcRenderer.invoke(CHANNELS.pulse.delete, id),
    toggle: (id: string, isActive: boolean) =>
      ipcRenderer.invoke(CHANNELS.pulse.toggle, id, isActive),
    runNow: (id: string) => ipcRenderer.invoke(CHANNELS.pulse.runNow, id),
  },
};

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", api);

export type ApiType = typeof api;
