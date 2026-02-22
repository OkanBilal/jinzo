import { projectsService } from "./projects.service";
import type { CreateProjectPayload, UpdateProjectPayload } from "./projects.dto";

// ─────────────────────────────────────────────────────────────
// Projects Controller
// ─────────────────────────────────────────────────────────────
export const projectsController = {
  getAll: () => projectsService.getAll(),
  getById: (id: string) => projectsService.getById(id),
  getByAccountId: (accountId: string) => projectsService.getByAccountId(accountId),
  findByRemoteOrigin: (accountId: string, remoteOrigin: string) =>
    projectsService.findByRemoteOrigin(accountId, remoteOrigin),
  findOrCreate: (payload: CreateProjectPayload) => projectsService.findOrCreate(payload),
  create: (payload: CreateProjectPayload) => projectsService.create(payload),
  update: (id: string, payload: UpdateProjectPayload) => projectsService.update(id, payload),
  remove: (id: string) => projectsService.remove(id),
  delete: (id: string) => projectsService.delete(id),
  archive: (id: string) => projectsService.archive(id),
};
