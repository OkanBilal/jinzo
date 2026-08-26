/**
 * The slice of mains's channel map the phone uses — a mirror of
 * `mains/src/shared/ipc-kit/channels.ts`, restricted to what a paired device
 * may invoke (see `PAIRED_DEVICE_CHANNELS` / `PAIRED_DEVICE_COMMANDS` in
 * mains's backend module). Keep the strings identical; a typo here is a
 * runtime "not available" reply, not a compile error, until this folder
 * becomes the shared contracts package.
 */
export const CHANNELS = {
  account: {
    get: "account:get",
  },
  backend: {
    describe: "backend:describe",
  },
  runs: {
    getAll: "runs:getAll",
    getById: "runs:getById",
    listPendingApprovals: "runs:listPendingApprovals",
    // push events
    statusChanged: "runs:statusChanged",
    eventPersisted: "runs:eventPersisted",
    updated: "runs:updated",
    toolApprovalRequest: "runs:toolApprovalRequest",
    toolApprovalResolved: "runs:toolApprovalResolved",
    diffUpdated: "runs:diffUpdated",
    // commands (require a commandId — see backendSession.command)
    continue: "runs:continue",
    execute: "runs:execute",
    toolApprovalResponse: "runs:toolApprovalResponse",
  },
  runTurns: {
    getByRun: "runTurns:getByRun",
  },
  runToolCalls: {
    getByRun: "runToolCalls:getByRun",
  },
  runArtifacts: {
    getByRun: "runArtifacts:getByRun",
  },
  workspace: {
    list: "workspace:list",
    listGitStates: "workspace:listGitStates",
    getLatestDiffSummary: "workspace:getLatestDiffSummary",
    // push — a workspace's branch changed (the Mac watches .git)
    gitStateChanged: "workspace:gitStateChanged",
  },
  projects: {
    list: "projects:list",
  },
  space: {
    getAll: "space:getAll",
    // command — the phone only ever changes a space's mode
    update: "space:update",
  },
  providers: {
    getEnabled: "providers:getEnabled",
    getModels: "providers:getModels",
    // push — a provider enriched its model list (e.g. per-model effort levels)
    modelsUpdated: "providers:modelsUpdated",
    // command — the composer toolbar's settings as one narrow patch
    updateRunSettings: "providers:updateRunSettings",
  },
  collections: {
    list: "collections:list",
  },
} as const;
