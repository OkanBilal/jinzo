import { ipcMain } from "electron";
import { updatesController } from "./updates.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerUpdatesIpc() {
  ipcMain.handle("updates:check", () => updatesController.checkForUpdates());
  ipcMain.handle("updates:download", () => updatesController.downloadUpdate());
  ipcMain.handle("updates:quitAndInstall", () => updatesController.quitAndInstall());
  ipcMain.handle("updates:getStatus", () => updatesController.getStatus());

  console.log("Updates IPC handlers registered");
}

export function unregisterUpdatesIpc() {
  ipcMain.removeHandler("updates:check");
  ipcMain.removeHandler("updates:download");
  ipcMain.removeHandler("updates:quitAndInstall");
  ipcMain.removeHandler("updates:getStatus");
}
