import { ipcMain } from "electron";
import { projectsService } from "./projects.service";
import type { CreateProjectPayload, UpdateProjectPayload } from "./projects.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProjectsIpc(): void {
  ipcMain.handle(CHANNELS.projects.getAll, async () => {
    return projectsService.getAll();
  });

  ipcMain.handle(CHANNELS.projects.getById, async (_, id: string) => {
    return projectsService.getById(id);
  });

  ipcMain.handle(CHANNELS.projects.getByAccount, async (_, accountId: string) => {
    return projectsService.getByAccountId(accountId);
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
}

export function unregisterProjectsIpc(): void {
  [
    CHANNELS.projects.getAll,
    CHANNELS.projects.getById,
    CHANNELS.projects.getByAccount,
    CHANNELS.projects.findByRemoteOrigin,
    CHANNELS.projects.findOrCreate,
    CHANNELS.projects.create,
    CHANNELS.projects.update,
    CHANNELS.projects.remove,
    CHANNELS.projects.delete,
    CHANNELS.projects.archive,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
