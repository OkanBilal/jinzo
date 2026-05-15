export { registerProjectsIpc, unregisterProjectsIpc } from "./projects.ipc";
export { projectsService } from "./projects.service";
export { projectsRepo } from "./projects.repo";
export { normalizeRemoteOrigin } from "./projects.utils";
export type {
  ProjectResponse,
  CreateProjectPayload,
  UpdateProjectPayload,
  ServiceResponse,
} from "./projects.dto";
