import { ipcMain } from "electron";
import { spaceService } from "./space.service";

// ─────────────────────────────────────────────────────────────
// Space IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerSpaceIpc() {
  // Get all spaces
  ipcMain.handle("space:getAll", async () => {
    return spaceService.getAll();
  });

  // Get space by ID
  ipcMain.handle("space:getById", async (_event, spaceId: string) => {
    return spaceService.getById(spaceId);
  });

  // Create space
  ipcMain.handle("space:create", async (_event, payload: unknown) => {
    return spaceService.create(payload);
  });

  // Update space
  ipcMain.handle(
    "space:update",
    async (_event, spaceId: string, payload: unknown) => {
      return spaceService.update(spaceId, payload);
    }
  );

  // Delete space
  ipcMain.handle("space:delete", async (_event, spaceId: string) => {
    return spaceService.delete(spaceId);
  });

  // Archive space
  ipcMain.handle("space:archive", async (_event, spaceId: string) => {
    return spaceService.archive(spaceId);
  });

  // Unarchive space
  ipcMain.handle("space:unarchive", async (_event, spaceId: string) => {
    return spaceService.unarchive(spaceId);
  });

}

export function unregisterSpaceIpc() {
  ipcMain.removeHandler("space:getAll");
  ipcMain.removeHandler("space:getById");
  ipcMain.removeHandler("space:create");
  ipcMain.removeHandler("space:update");
  ipcMain.removeHandler("space:delete");
  ipcMain.removeHandler("space:archive");
  ipcMain.removeHandler("space:unarchive");
}
