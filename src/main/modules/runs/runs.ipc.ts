import { ipcMain } from "electron";
import { ok } from "../../../shared/ipc-kit/service-response";
import { runsService } from "./runs.service";
import type {
  CreateRunPayload,
  UpdateRunPayload,
  CreateRunContextPayload,
  CreateRunArtifactPayload,
  RunStatus,
  StartRunPayload,
  ContinueRunPayload,
  ForkRunPayload,
  ReviewRunPayload,
  ToolApprovalResponse,
} from "./runs.dto";
import { handleToolApprovalResponse } from "./user-input-broker";

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
  RUNS_ARCHIVE: "runs:archive",
  RUNS_GET_DETAILS: "runs:getDetails",
  RUNS_EXECUTE: "runs:execute",
  RUNS_ABORT: "runs:abort",
  RUNS_CONTINUE: "runs:continue",
  RUNS_FORK: "runs:fork",
  RUNS_EXECUTE_REVIEW: "runs:executeReview",
  RUNS_CAN_RESUME: "runs:canResume",
  RUNS_DELETE_SESSION: "runs:deleteSession",

  // Run Context
  CONTEXT_GET_BY_RUN: "runContext:getByRun",
  CONTEXT_ADD: "runContext:add",
  CONTEXT_REMOVE: "runContext:remove",

  // Run Artifacts
  ARTIFACTS_GET_BY_RUN: "runArtifacts:getByRun",
  ARTIFACTS_ADD: "runArtifacts:add",
  ARTIFACTS_REMOVE: "runArtifacts:remove",


  // Tool Calls
  TOOL_CALLS_GET_BY_RUN: "runToolCalls:getByRun",

  // Run Turns
  TURNS_GET_BY_RUN: "runTurns:getByRun",

  // Tool Approval (interactive)
  RUNS_TOOL_APPROVAL_RESPONSE: "runs:toolApprovalResponse",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerRunsIpc(): void {
  // Runs
  ipcMain.handle(CHANNELS.RUNS_GET_ALL, async (_, limit?: number) => {
    return runsService.getAllRuns(limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_ID, async (_, id: string) => {
    return runsService.getRunById(id);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_ACCOUNT, async (_, accountId: string, limit?: number) => {
    return runsService.getRunsByAccount(accountId, limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_WORKSPACE, async (_, workspaceId: string, limit?: number) => {
    return runsService.getRunsByWorkspace(workspaceId, limit);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_BY_STATUS, async (_, accountId: string, status: RunStatus) => {
    return runsService.getRunsByStatus(accountId, status);
  });

  ipcMain.handle(CHANNELS.RUNS_CREATE, async (_, payload: CreateRunPayload) => {
    return runsService.createRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_UPDATE, async (_, id: string, payload: UpdateRunPayload) => {
    return runsService.updateRun(id, payload);
  });

  ipcMain.handle(CHANNELS.RUNS_START, async (_, id: string) => {
    return runsService.startRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_COMPLETE, async (_, id: string) => {
    return runsService.completeRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_FAIL, async (_, id: string, error: string) => {
    return runsService.failRun(id, error);
  });

  ipcMain.handle(CHANNELS.RUNS_CANCEL, async (_, id: string) => {
    return runsService.cancelRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_DELETE, async (_, id: string) => {
    return runsService.deleteRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_ARCHIVE, async (_, id: string) => {
    return runsService.archiveRun(id);
  });

  ipcMain.handle(CHANNELS.RUNS_GET_DETAILS, async (_, runId: string) => {
    return runsService.getRunDetails(runId);
  });

  ipcMain.handle(CHANNELS.RUNS_EXECUTE, async (_, payload: StartRunPayload) => {
    return runsService.executeRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_ABORT, async (_, runId: string) => {
    return runsService.abortRun(runId);
  });

  ipcMain.handle(CHANNELS.RUNS_CONTINUE, async (_, payload: ContinueRunPayload) => {
    return runsService.continueRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_FORK, async (_, payload: ForkRunPayload) => {
    return runsService.forkRun(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_EXECUTE_REVIEW, async (_, payload: ReviewRunPayload) => {
    return runsService.executeReview(payload);
  });

  ipcMain.handle(CHANNELS.RUNS_CAN_RESUME, async (_, runId: string) => {
    return runsService.canResumeRun(runId);
  });

  ipcMain.handle(CHANNELS.RUNS_DELETE_SESSION, async (_, runId: string) => {
    return runsService.deleteRunSession(runId);
  });

  // Run Context
  ipcMain.handle(CHANNELS.CONTEXT_GET_BY_RUN, async (_, runId: string) => {
    return runsService.getContextByRun(runId);
  });

  ipcMain.handle(CHANNELS.CONTEXT_ADD, async (_, payload: CreateRunContextPayload) => {
    return runsService.addContext(payload);
  });

  ipcMain.handle(CHANNELS.CONTEXT_REMOVE, async (_, id: number) => {
    return runsService.removeContext(id);
  });

  // Run Artifacts
  ipcMain.handle(CHANNELS.ARTIFACTS_GET_BY_RUN, async (_, runId: string) => {
    return runsService.getArtifactsByRun(runId);
  });

  ipcMain.handle(CHANNELS.ARTIFACTS_ADD, async (_, payload: CreateRunArtifactPayload) => {
    return runsService.addArtifact(payload);
  });

  ipcMain.handle(CHANNELS.ARTIFACTS_REMOVE, async (_, id: number) => {
    return runsService.removeArtifact(id);
  });


  // Tool Calls
  ipcMain.handle(CHANNELS.TOOL_CALLS_GET_BY_RUN, async (_, runId: string) => {
    return runsService.getToolCallsByRun(runId);
  });

  // Run Turns
  ipcMain.handle(CHANNELS.TURNS_GET_BY_RUN, async (_, runId: string) => {
    return runsService.getTurnsByRun(runId);
  });

  // Tool Approval (interactive)
  ipcMain.handle(
    CHANNELS.RUNS_TOOL_APPROVAL_RESPONSE,
    async (_, response: ToolApprovalResponse) => {
      handleToolApprovalResponse(response);
      return ok(undefined);
    },
  );
}

export function unregisterRunsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
