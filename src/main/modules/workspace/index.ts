export { registerWorkspaceIpc, unregisterWorkspaceIpc } from "./workspace.ipc";
export {
  workspaceService,
  logWorkspaceActivity,
  emitFindingsChanged,
} from "./workspace.service";
export { workspaceRepo } from "./workspace.repo";
export type {
  // workspace
  WorkspaceMetadata,
  WorktreeMetadata,
  NoWorktreeMetadata,
  OriginMetadata,
  WorkspaceStatus,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceIntakeSource,
  WorkspaceIntakePayload,
  WorkspaceResponse,
  WorkspaceListResponse,
  ScriptCompleteEvent,
  // activity
  ActivityType,
  ActivityResponse,
  CreateActivityPayload,
  // diffs
  WorkspaceDiffResponse,
  WorkspaceDiffSummaryResponse,
  CreateDiffPayload,
  UpdateDiffPayload,
  // reviews
  ReviewStatus,
  ReviewResponse,
  CreateReviewPayload,
  UpdateReviewPayload,
  // findings
  FindingSeverity,
  ReviewFindingResponse,
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
  // shared envelope
  ServiceResponse,
} from "./workspace.dto";
