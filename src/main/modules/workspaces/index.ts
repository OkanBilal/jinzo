export { registerWorkspacesIpc, unregisterWorkspacesIpc } from "./workspaces.ipc";
export { workspacesService } from "./workspaces.service";
export { workspacesRepo } from "./workspaces.repo";
export type {
  WorkspaceMetadata,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceResponse,
  WorkspaceListResponse,
  ServiceResponse,
} from "./workspaces.dto";
