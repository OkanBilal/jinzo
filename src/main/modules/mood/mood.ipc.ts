import { ipcMain } from "electron";
import { moodController } from "./mood.controller";

// ─────────────────────────────────────────────────────────────
// Mood IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerMoodIpc() {
  // Get all moods
  ipcMain.handle("mood:getAll", async () => {
    return moodController.getAll();
  });

  // Get mood by ID
  ipcMain.handle("mood:getById", async (_event, moodId: string) => {
    return moodController.getById(moodId);
  });

  // Create mood
  ipcMain.handle("mood:create", async (_event, payload: unknown) => {
    return moodController.create(payload);
  });

  // Update mood
  ipcMain.handle(
    "mood:update",
    async (_event, moodId: string, payload: unknown) => {
      return moodController.update(moodId, payload);
    }
  );

  // Delete mood
  ipcMain.handle("mood:delete", async (_event, moodId: string) => {
    return moodController.delete(moodId);
  });

  // Archive mood
  ipcMain.handle("mood:archive", async (_event, moodId: string) => {
    return moodController.archive(moodId);
  });

  console.log("Mood handlers registered");
}

export function unregisterMoodIpc() {
  ipcMain.removeHandler("mood:getAll");
  ipcMain.removeHandler("mood:getById");
  ipcMain.removeHandler("mood:create");
  ipcMain.removeHandler("mood:update");
  ipcMain.removeHandler("mood:delete");
  ipcMain.removeHandler("mood:archive");
}
