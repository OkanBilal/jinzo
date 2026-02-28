import { ipcMain } from "electron";
import { spaceController } from "./space.controller";

// ─────────────────────────────────────────────────────────────
// Space IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerSpaceIpc() {
  // Get all spaces
  ipcMain.handle("space:getAll", async () => {
    return spaceController.getAll();
  });

  // Get space by ID
  ipcMain.handle("space:getById", async (_event, spaceId: string) => {
    return spaceController.getById(spaceId);
  });

  // Create space
  ipcMain.handle("space:create", async (_event, payload: unknown) => {
    return spaceController.create(payload);
  });

  // Update space
  ipcMain.handle(
    "space:update",
    async (_event, spaceId: string, payload: unknown) => {
      return spaceController.update(spaceId, payload);
    }
  );

  // Delete space
  ipcMain.handle("space:delete", async (_event, spaceId: string) => {
    return spaceController.delete(spaceId);
  });

  // Archive space
  ipcMain.handle("space:archive", async (_event, spaceId: string) => {
    return spaceController.archive(spaceId);
  });

  console.log("Space handlers registered");
}

export function unregisterSpaceIpc() {
  ipcMain.removeHandler("space:getAll");
  ipcMain.removeHandler("space:getById");
  ipcMain.removeHandler("space:create");
  ipcMain.removeHandler("space:update");
  ipcMain.removeHandler("space:delete");
  ipcMain.removeHandler("space:archive");
}
