import { ipcMain } from "electron";
import { runsController } from "./runs.controller";
import type {
  CreateRunPayload,
  UpdateRunPayload,
  CreateRunContextPayload,
  CreateRunArtifactPayload,
  CreateRunCommandPayload,
  UpdateRunCommandPayload,
  RunStatus,
  StartRunPayload,
} from "./runs.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  // Runs
  RUNS_GET_ALL: "runs:getAll",
  RUNS_GET_BY_ID: "runs:getById",
  RUNS_GET_BY_ACCOUNT: "runs:getByAccount",
  RUNS_GET_BY_WORKSPACE: "runs:getByWorkspace",
  RUNS_GET_BY_STATUS: "runs:getByStatus",
  RUNS_CREATE: "runs:create",
  RUNS_UPDATE: "runs:update",
  RUNS_START: "runs:start",
  RUNS_COMPLETE: "runs:complete",
  RUNS_FAIL: "runs:fail",
  RUNS_CANCEL: "runs:cancel",
  RUNS_DELETE: "runs:delete",
  RUNS_GET_DETAILS: "runs:getDetails",
  RUNS_EXECUTE: "runs:execute",
  RUNS_ABORT: "runs:abort",

  // Run Context
  CONTEXT_GET_BY_RUN: "runContext:getByRun",
  CONTEXT_ADD: "runContext:add",
  CONTEXT_REMOVE: "runContext:remove",

  // Run Artifacts
  ARTIFACTS_GET_BY_RUN: "runArtifacts:getByRun",
  ARTIFACTS_ADD: "runArtifacts:add",
  ARTIFACTS_REMOVE: "runArtifacts:remove",

  // Run Commands
  COMMANDS_GET_BY_RUN: "runCommands:getByRun",
  COMMANDS_ADD: "runCommands:add",
  COMMANDS_UPDATE: "runCommands:update",
  COMMANDS_START: "runCommands:start",
  COMMANDS_COMPLETE: "runCommands:complete",
  COMMANDS_REMOVE: "runCommands:remove",

  // Tool Calls
  TOOL_CALLS_GET_BY_RUN: "runToolCalls:getByRun",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerRunsIpc(): void {
  // Runs
  ipcMain.handle(CHANNELS.RUNS_GET_ALL, async (_, limit?: number) => {
    return runsController.getAllRuns(limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_ID, async (_, id: string) => {
    return runsController.getRunById(id);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_ACCOUNT, async (_, accountId: string, limit?: number) => {
    return runsController.getRunsByAccount(accountId, limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_WORKSPACE, async (_, workspaceId: string, limit?: number) => {
    return runsController.getRunsByWorkspace(workspaceId, limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_STATUS, async (_, accountId: string, status: RunStatus) => {
    return runsController.getRunsByStatus(accountId, status);
  });

  ipcMain.handle(CHANNELS.RUNS_CREATE, async (_, payload: CreateRunPayload) => {
    return runsController.createRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_UPDATE, async (_, id: string, payload: UpdateRunPayload) => {
    return runsController.updateRun(id, payload);
  });

  ipcMain.handle(CHANNELS.RUNS_START, async (_, id: string) => {
    return runsController.startRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_COMPLETE, async (_, id: string) => {
    return runsController.completeRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_FAIL, async (_, id: string, error: string) => {
    return runsController.failRun(id, error);
  });

  ipcMain.handle(CHANNELS.RUNS_CANCEL, async (_, id: string) => {
    return runsController.cancelRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_DELETE, async (_, id: string) => {
    return runsController.deleteRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_DETAILS, async (_, runId: string) => {
    return runsController.getRunDetails(runId);
  });

  ipcMain.handle(CHANNELS.RUNS_EXECUTE, async (_, payload: StartRunPayload) => {
    return runsController.executeRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_ABORT, async (_, runId: string) => {
    return runsController.abortRun(runId);
  });

  // Run Context
  ipcMain.handle(CHANNELS.CONTEXT_GET_BY_RUN, async (_, runId: string) => {
    return runsController.getContextByRun(runId);
  });

  ipcMain.handle(CHANNELS.CONTEXT_ADD, async (_, payload: CreateRunContextPayload) => {
    return runsController.addContext(payload);
  });

  ipcMain.handle(CHANNELS.CONTEXT_REMOVE, async (_, id: number) => {
    return runsController.removeContext(id);
  });

  // Run Artifacts
  ipcMain.handle(CHANNELS.ARTIFACTS_GET_BY_RUN, async (_, runId: string) => {
    return runsController.getArtifactsByRun(runId);
  });

  ipcMain.handle(CHANNELS.ARTIFACTS_ADD, async (_, payload: CreateRunArtifactPayload) => {
    return runsController.addArtifact(payload);
  });

  ipcMain.handle(CHANNELS.ARTIFACTS_REMOVE, async (_, id: number) => {
    return runsController.removeArtifact(id);
  });

  // Run Commands
  ipcMain.handle(CHANNELS.COMMANDS_GET_BY_RUN, async (_, runId: string) => {
    return runsController.getCommandsByRun(runId);
  });

  ipcMain.handle(CHANNELS.COMMANDS_ADD, async (_, payload: CreateRunCommandPayload) => {
    return runsController.addCommand(payload);
  });

  ipcMain.handle(
    CHANNELS.COMMANDS_UPDATE,
    async (_, id: number, payload: UpdateRunCommandPayload) => {
      return runsController.updateCommand(id, payload);
    }
  );

  ipcMain.handle(CHANNELS.COMMANDS_START, async (_, id: number) => {
    return runsController.startCommand(id);
  });

  ipcMain.handle(
    CHANNELS.COMMANDS_COMPLETE,
    async (_, id: number, exitCode: number, stdout?: string, stderr?: string) => {
      return runsController.completeCommand(id, exitCode, stdout, stderr);
    }
  );

  ipcMain.handle(CHANNELS.COMMANDS_REMOVE, async (_, id: number) => {
    return runsController.removeCommand(id);
  });

  // Tool Calls
  ipcMain.handle(CHANNELS.TOOL_CALLS_GET_BY_RUN, async (_, runId: string) => {
    return runsController.getToolCallsByRun(runId);
  });
}

export function unregisterRunsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
