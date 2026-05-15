import { ipcMain } from "electron";
import { projectsService } from "./projects.service";
import type { CreateProjectPayload, UpdateProjectPayload } from "./projects.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_ALL: "projects:getAll",
  GET_BY_ID: "projects:getById",
  GET_BY_ACCOUNT: "projects:getByAccount",
  FIND_BY_REMOTE_ORIGIN: "projects:findByRemoteOrigin",
  FIND_OR_CREATE: "projects:findOrCreate",
  CREATE: "projects:create",
  UPDATE: "projects:update",
  REMOVE: "projects:remove",
  DELETE: "projects:delete",
  ARCHIVE: "projects:archive",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProjectsIpc(): void {
  ipcMain.handle(CHANNELS.GET_ALL, async () => {
    return projectsService.getAll();
  });

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return projectsService.getById(id);
  });

  ipcMain.handle(CHANNELS.GET_BY_ACCOUNT, async (_, accountId: string) => {
    return projectsService.getByAccountId(accountId);
  });

  ipcMain.handle(
    CHANNELS.FIND_BY_REMOTE_ORIGIN,
    async (_, accountId: string, remoteOrigin: string) => {
      return projectsService.findByRemoteOrigin(accountId, remoteOrigin);
    },
  );

  ipcMain.handle(CHANNELS.FIND_OR_CREATE, async (_, payload: CreateProjectPayload) => {
    return projectsService.findOrCreate(payload);
  });

  ipcMain.handle(CHANNELS.CREATE, async (_, payload: CreateProjectPayload) => {
    return projectsService.create(payload);
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_, id: string, payload: UpdateProjectPayload) => {
    return projectsService.update(id, payload);
  });

  ipcMain.handle(CHANNELS.REMOVE, async (_, id: string) => {
    return projectsService.remove(id);
  });

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return projectsService.delete(id);
  });

  ipcMain.handle(CHANNELS.ARCHIVE, async (_, id: string) => {
    return projectsService.archive(id);
  });
}

export function unregisterProjectsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
