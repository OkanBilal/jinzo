export { registerWorkspaceIpc, unregisterWorkspaceIpc } from "./workspace.ipc";
export { workspaceService, logWorkspaceActivity } from "./workspace.service";
export { workspaceRepo } from "./workspace.repo";
export type {
  // workspace
  WorkspaceMetadata,
  WorktreeMetadata,
  OriginMetadata,
  WorkspaceStatus,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
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
