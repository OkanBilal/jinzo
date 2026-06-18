import { ipcMain } from "../../ipc-kit/ipc-main";
import { projectsService } from "./projects.service";
import type {
  AddResourcePayload,
  CreateProjectPayload,
  RemoveResourcePayload,
  UpdateProjectPayload,
} from "./projects.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// Projects IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProjectsIpc(): void {
  // ── lifecycle ──
  ipcMain.handle(CHANNELS.projects.list, async () => {
    return projectsService.list();
  });

  ipcMain.handle(CHANNELS.projects.get, async (_, id: string) => {
    return projectsService.get(id);
  });

  ipcMain.handle(CHANNELS.projects.listByAccount, async (_, accountId: string) => {
    return projectsService.listByAccount(accountId);
  });

  ipcMain.handle(
    CHANNELS.projects.findByRemoteOrigin,
    async (_, accountId: string, remoteOrigin: string) => {
      return projectsService.findByRemoteOrigin(accountId, remoteOrigin);
    },
  );

  ipcMain.handle(CHANNELS.projects.findOrCreate, async (_, payload: CreateProjectPayload) => {
    return projectsService.findOrCreate(payload);
  });

  ipcMain.handle(CHANNELS.projects.create, async (_, payload: CreateProjectPayload) => {
    return projectsService.create(payload);
  });

  ipcMain.handle(CHANNELS.projects.update, async (_, id: string, payload: UpdateProjectPayload) => {
    return projectsService.update(id, payload);
  });

  ipcMain.handle(CHANNELS.projects.remove, async (_, id: string) => {
    return projectsService.remove(id);
  });

  ipcMain.handle(CHANNELS.projects.delete, async (_, id: string) => {
    return projectsService.delete(id);
  });

  ipcMain.handle(CHANNELS.projects.archive, async (_, id: string) => {
    return projectsService.archive(id);
  });

  // ── resources ──
  ipcMain.handle(CHANNELS.projects.listResources, async (_, projectId: string) => {
    return projectsService.listResources(projectId);
  });

  ipcMain.handle(CHANNELS.projects.listAvailableResources, async (_, projectId: string) => {
    return projectsService.listAvailableResources(projectId);
  });

  ipcMain.handle(CHANNELS.projects.addResource, async (_, payload: AddResourcePayload) => {
    return projectsService.addResource(payload.projectId, payload.resourceId);
  });

  ipcMain.handle(CHANNELS.projects.removeResource, async (_, payload: RemoveResourcePayload) => {
    return projectsService.removeResource(payload.projectId, payload.resourceId);
  });

  // ── issues (via linked resources) ──
  ipcMain.handle(CHANNELS.projects.listIssues, async (_, projectId: string) => {
    return projectsService.listIssues(projectId);
  });
}

export function unregisterProjectsIpc(): void {
  [
    CHANNELS.projects.list,
    CHANNELS.projects.get,
    CHANNELS.projects.listByAccount,
    CHANNELS.projects.findByRemoteOrigin,
    CHANNELS.projects.findOrCreate,
    CHANNELS.projects.create,
    CHANNELS.projects.update,
    CHANNELS.projects.remove,
    CHANNELS.projects.delete,
    CHANNELS.projects.archive,
    CHANNELS.projects.listResources,
    CHANNELS.projects.listAvailableResources,
    CHANNELS.projects.addResource,
    CHANNELS.projects.removeResource,
    CHANNELS.projects.listIssues,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
