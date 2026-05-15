import { ipcMain } from "electron";
import { spaceService } from "./space.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// Space IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerSpaceIpc() {
  // Get all spaces
  ipcMain.handle(CHANNELS.space.getAll, async () => {
    return spaceService.getAll();
  });

  // Get space by ID
  ipcMain.handle(CHANNELS.space.getById, async (_event, spaceId: string) => {
    return spaceService.getById(spaceId);
  });

  // Create space
  ipcMain.handle(CHANNELS.space.create, async (_event, payload: unknown) => {
    return spaceService.create(payload);
  });

  // Update space
  ipcMain.handle(
    CHANNELS.space.update,
    async (_event, spaceId: string, payload: unknown) => {
      return spaceService.update(spaceId, payload);
    }
  );

  // Delete space
  ipcMain.handle(CHANNELS.space.delete, async (_event, spaceId: string) => {
    return spaceService.delete(spaceId);
  });

  // Archive space
  ipcMain.handle(CHANNELS.space.archive, async (_event, spaceId: string) => {
    return spaceService.archive(spaceId);
  });

  // Unarchive space
  ipcMain.handle(CHANNELS.space.unarchive, async (_event, spaceId: string) => {
    return spaceService.unarchive(spaceId);
  });

}

export function unregisterSpaceIpc() {
  ipcMain.removeHandler(CHANNELS.space.getAll);
  ipcMain.removeHandler(CHANNELS.space.getById);
  ipcMain.removeHandler(CHANNELS.space.create);
  ipcMain.removeHandler(CHANNELS.space.update);
  ipcMain.removeHandler(CHANNELS.space.delete);
  ipcMain.removeHandler(CHANNELS.space.archive);
  ipcMain.removeHandler(CHANNELS.space.unarchive);
}
