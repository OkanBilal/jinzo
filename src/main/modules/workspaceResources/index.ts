export { workspaceResourcesService } from "./workspaceResources.service";
export { workspaceResourcesRepo } from "./workspaceResources.repo";
export {
  registerWorkspaceResourcesHandlers,
  unregisterWorkspaceResourcesHandlers,
} from "./workspaceResources.ipc";
export type {
  ProjectResource,
  ProjectResourceWithDetails,
  AvailableResource,
  AddResourcePayload,
  RemoveResourcePayload,
  ServiceResponse,
} from "./workspaceResources.dto";
