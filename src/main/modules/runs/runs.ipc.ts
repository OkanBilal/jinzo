import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit/handle";
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
  ipcMain.handle(
    CHANNELS.runs.getAll,
    handle((limit?: number) => runsService.getAllRuns(limit)),
  );

  ipcMain.handle(
    CHANNELS.runs.getById,
    handle((id: string) => runsService.getRunById(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.getByAccount,
    handle((accountId: string, limit?: number) => runsService.getRunsByAccount(accountId, limit)),
  );

  ipcMain.handle(
    CHANNELS.runs.getByWorkspace,
    handle((workspaceId: string, limit?: number) => runsService.getRunsByWorkspace(workspaceId, limit)),
  );

  ipcMain.handle(
    CHANNELS.runs.getByStatus,
    handle((accountId: string, status: RunStatus) => runsService.getRunsByStatus(accountId, status)),
  );

  ipcMain.handle(
    CHANNELS.runs.create,
    handle((payload: CreateRunPayload) => runsService.createRun(payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.update,
    handle((id: string, payload: UpdateRunPayload) => runsService.updateRun(id, payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.start,
    handle((id: string) => runsService.startRun(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.complete,
    handle((id: string) => runsService.completeRun(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.fail,
    handle((id: string, error: string) => runsService.failRun(id, error)),
  );

  ipcMain.handle(
    CHANNELS.runs.cancel,
    handle((id: string) => runsService.cancelRun(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.delete,
    handle((id: string) => runsService.deleteRun(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.archive,
    handle((id: string) => runsService.archiveRun(id)),
  );

  ipcMain.handle(
    CHANNELS.runs.getDetails,
    handle((runId: string) => runsService.getRunDetails(runId)),
  );

  ipcMain.handle(
    CHANNELS.runs.execute,
    handle((payload: StartRunPayload) => runsService.executeRun(payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.abort,
    handle((runId: string) => runsService.abortRun(runId)),
  );

  ipcMain.handle(
    CHANNELS.runs.continue,
    handle((payload: ContinueRunPayload) => runsService.continueRun(payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.fork,
    handle((payload: ForkRunPayload) => runsService.forkRun(payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.executeReview,
    handle((payload: ReviewRunPayload) => runsService.executeReview(payload)),
  );

  ipcMain.handle(
    CHANNELS.runs.canResume,
    handle((runId: string) => runsService.canResumeRun(runId)),
  );

  ipcMain.handle(
    CHANNELS.runs.deleteSession,
    handle((runId: string) => runsService.deleteRunSession(runId)),
  );

  // Run Context
  ipcMain.handle(
    CHANNELS.runContext.getByRun,
    handle((runId: string) => runsService.getContextByRun(runId)),
  );

  ipcMain.handle(
    CHANNELS.runContext.add,
    handle((payload: CreateRunContextPayload) => runsService.addContext(payload)),
  );

  ipcMain.handle(
    CHANNELS.runContext.remove,
    handle((id: number) => runsService.removeContext(id)),
  );

  // Run Artifacts
  ipcMain.handle(
    CHANNELS.runArtifacts.getByRun,
    handle((runId: string, sinceId?: number) => runsService.getArtifactsByRun(runId, sinceId)),
  );

  ipcMain.handle(
    CHANNELS.runArtifacts.add,
    handle((payload: CreateRunArtifactPayload) => runsService.addArtifact(payload)),
  );

  ipcMain.handle(
    CHANNELS.runArtifacts.remove,
    handle((id: number) => runsService.removeArtifact(id)),
  );


  // Tool Calls
  ipcMain.handle(
    CHANNELS.runToolCalls.getByRun,
    handle((runId: string, sinceUpdatedAt?: Date) => runsService.getToolCallsByRun(runId, sinceUpdatedAt)),
  );

  // Run Turns
  ipcMain.handle(
    CHANNELS.runTurns.getByRun,
    handle((runId: string) => runsService.getTurnsByRun(runId)),
  );

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
