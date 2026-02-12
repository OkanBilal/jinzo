import { runsService } from "./runs.service";
import type {
  CreateRunPayload,
  UpdateRunPayload,
  CreateRunContextPayload,
  CreateRunArtifactPayload,
  CreateRunCommandPayload,
  UpdateRunCommandPayload,
  RunStatus,
  StartRunPayload,
  ContinueRunPayload,
} from "./runs.dto";

// ─────────────────────────────────────────────────────────────
// Runs Controller
// ─────────────────────────────────────────────────────────────
export const runsController = {
  // Run Operations
  getAllRuns: (limit?: number) => runsService.getAllRuns(limit),
  getRunById: (id: string) => runsService.getRunById(id),
  getRunsByAccount: (accountId: string, limit?: number) =>
    runsService.getRunsByAccount(accountId, limit),
  getRunsByWorkspace: (workspaceId: string, limit?: number) =>
    runsService.getRunsByWorkspace(workspaceId, limit),
  getRunsByStatus: (accountId: string, status: RunStatus) =>
    runsService.getRunsByStatus(accountId, status),
  createRun: (payload: CreateRunPayload) => runsService.createRun(payload),
  updateRun: (id: string, payload: UpdateRunPayload) => runsService.updateRun(id, payload),
  startRun: (id: string) => runsService.startRun(id),
  completeRun: (id: string) => runsService.completeRun(id),
  failRun: (id: string, error: string) => runsService.failRun(id, error),
  cancelRun: (id: string) => runsService.cancelRun(id),
  deleteRun: (id: string) => runsService.deleteRun(id),
  archiveRun: (id: string) => runsService.archiveRun(id),

  // Run Context Operations
  getContextByRun: (runId: string) => runsService.getContextByRun(runId),
  addContext: (payload: CreateRunContextPayload) => runsService.addContext(payload),
  removeContext: (id: number) => runsService.removeContext(id),

  // Run Artifact Operations
  getArtifactsByRun: (runId: string) => runsService.getArtifactsByRun(runId),
  addArtifact: (payload: CreateRunArtifactPayload) => runsService.addArtifact(payload),
  removeArtifact: (id: number) => runsService.removeArtifact(id),

  // Run Command Operations
  getCommandsByRun: (runId: string) => runsService.getCommandsByRun(runId),
  addCommand: (payload: CreateRunCommandPayload) => runsService.addCommand(payload),
  updateCommand: (id: number, payload: UpdateRunCommandPayload) =>
    runsService.updateCommand(id, payload),
  startCommand: (id: number) => runsService.startCommand(id),
  completeCommand: (id: number, exitCode: number, stdout?: string, stderr?: string) =>
    runsService.completeCommand(id, exitCode, stdout, stderr),
  removeCommand: (id: number) => runsService.removeCommand(id),

  // Tool Call Operations
  getToolCallsByRun: (runId: string) => runsService.getToolCallsByRun(runId),

  // Run Details (all related data)
  getRunDetails: (runId: string) => runsService.getRunDetails(runId),

  // Execute Run (main orchestration)
  executeRun: (payload: StartRunPayload) => runsService.executeRun(payload),

  // Abort Run
  abortRun: (runId: string) => runsService.abortRun(runId),

  // Continue Run (resume session)
  continueRun: (payload: ContinueRunPayload) => runsService.continueRun(payload),

  // Check if run can be resumed
  canResumeRun: (runId: string) => runsService.canResumeRun(runId),

  // Delete run session
  deleteRunSession: (runId: string) => runsService.deleteRunSession(runId),
};
