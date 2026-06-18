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
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerRunsIpc(): void {
  // Runs
  ipcMain.handle(CHANNELS.runs.getAll, async (_, limit?: number) => {
    return runsService.getAllRuns(limit);
  });

  ipcMain.handle(CHANNELS.runs.getById, async (_, id: string) => {
    return runsService.getRunById(id);
  });

  ipcMain.handle(CHANNELS.runs.getByAccount, async (_, accountId: string, limit?: number) => {
    return runsService.getRunsByAccount(accountId, limit);
  });

  ipcMain.handle(CHANNELS.runs.getByWorkspace, async (_, workspaceId: string, limit?: number) => {
    return runsService.getRunsByWorkspace(workspaceId, limit);
  });

  ipcMain.handle(CHANNELS.runs.getByStatus, async (_, accountId: string, status: RunStatus) => {
    return runsService.getRunsByStatus(accountId, status);
  });

  ipcMain.handle(CHANNELS.runs.create, async (_, payload: CreateRunPayload) => {
    return runsService.createRun(payload);
  });

  ipcMain.handle(CHANNELS.runs.update, async (_, id: string, payload: UpdateRunPayload) => {
    return runsService.updateRun(id, payload);
  });

  ipcMain.handle(CHANNELS.runs.start, async (_, id: string) => {
    return runsService.startRun(id);
  });

  ipcMain.handle(CHANNELS.runs.complete, async (_, id: string) => {
    return runsService.completeRun(id);
  });

  ipcMain.handle(CHANNELS.runs.fail, async (_, id: string, error: string) => {
    return runsService.failRun(id, error);
  });

  ipcMain.handle(CHANNELS.runs.cancel, async (_, id: string) => {
    return runsService.cancelRun(id);
  });

  ipcMain.handle(CHANNELS.runs.delete, async (_, id: string) => {
    return runsService.deleteRun(id);
  });

  ipcMain.handle(CHANNELS.runs.archive, async (_, id: string) => {
    return runsService.archiveRun(id);
  });

  ipcMain.handle(CHANNELS.runs.getDetails, async (_, runId: string) => {
    return runsService.getRunDetails(runId);
  });

  ipcMain.handle(CHANNELS.runs.execute, async (_, payload: StartRunPayload) => {
    return runsService.executeRun(payload);
  });

  ipcMain.handle(CHANNELS.runs.abort, async (_, runId: string) => {
    return runsService.abortRun(runId);
  });

  ipcMain.handle(CHANNELS.runs.continue, async (_, payload: ContinueRunPayload) => {
    return runsService.continueRun(payload);
  });

  ipcMain.handle(CHANNELS.runs.fork, async (_, payload: ForkRunPayload) => {
    return runsService.forkRun(payload);
  });

  ipcMain.handle(CHANNELS.runs.executeReview, async (_, payload: ReviewRunPayload) => {
    return runsService.executeReview(payload);
  });

  ipcMain.handle(CHANNELS.runs.canResume, async (_, runId: string) => {
    return runsService.canResumeRun(runId);
  });

  ipcMain.handle(CHANNELS.runs.deleteSession, async (_, runId: string) => {
    return runsService.deleteRunSession(runId);
  });

  // Run Context
  ipcMain.handle(CHANNELS.runContext.getByRun, async (_, runId: string) => {
    return runsService.getContextByRun(runId);
  });

  ipcMain.handle(CHANNELS.runContext.add, async (_, payload: CreateRunContextPayload) => {
    return runsService.addContext(payload);
  });

  ipcMain.handle(CHANNELS.runContext.remove, async (_, id: number) => {
    return runsService.removeContext(id);
  });

  // Run Artifacts
  ipcMain.handle(
    CHANNELS.runArtifacts.getByRun,
    async (_, runId: string, sinceId?: number) => {
      return runsService.getArtifactsByRun(runId, sinceId);
    },
  );

  ipcMain.handle(CHANNELS.runArtifacts.add, async (_, payload: CreateRunArtifactPayload) => {
    return runsService.addArtifact(payload);
  });

  ipcMain.handle(CHANNELS.runArtifacts.remove, async (_, id: number) => {
    return runsService.removeArtifact(id);
  });


  // Tool Calls
  ipcMain.handle(
    CHANNELS.runToolCalls.getByRun,
    async (_, runId: string, sinceUpdatedAt?: Date) => {
      return runsService.getToolCallsByRun(runId, sinceUpdatedAt);
    },
  );

  // Run Turns
  ipcMain.handle(CHANNELS.runTurns.getByRun, async (_, runId: string) => {
    return runsService.getTurnsByRun(runId);
  });

  // Tool Approval (interactive)
  ipcMain.handle(
    CHANNELS.runs.toolApprovalResponse,
    async (_, response: ToolApprovalResponse) => {
      handleToolApprovalResponse(response);
      return ok(undefined);
    },
  );
}

export function unregisterRunsIpc(): void {
  [
    CHANNELS.runs.getAll,
    CHANNELS.runs.getById,
    CHANNELS.runs.getByAccount,
    CHANNELS.runs.getByWorkspace,
    CHANNELS.runs.getByStatus,
    CHANNELS.runs.create,
    CHANNELS.runs.update,
    CHANNELS.runs.start,
    CHANNELS.runs.complete,
    CHANNELS.runs.fail,
    CHANNELS.runs.cancel,
    CHANNELS.runs.delete,
    CHANNELS.runs.archive,
    CHANNELS.runs.getDetails,
    CHANNELS.runs.execute,
    CHANNELS.runs.abort,
    CHANNELS.runs.continue,
    CHANNELS.runs.fork,
    CHANNELS.runs.executeReview,
    CHANNELS.runs.canResume,
    CHANNELS.runs.deleteSession,
    CHANNELS.runContext.getByRun,
    CHANNELS.runContext.add,
    CHANNELS.runContext.remove,
    CHANNELS.runArtifacts.getByRun,
    CHANNELS.runArtifacts.add,
    CHANNELS.runArtifacts.remove,
    CHANNELS.runToolCalls.getByRun,
    CHANNELS.runTurns.getByRun,
    CHANNELS.runs.toolApprovalResponse,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
