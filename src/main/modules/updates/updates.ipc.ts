import { ipcMain } from "electron";
import { updatesService } from "./updates.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerUpdatesIpc() {
  ipcMain.handle("updates:check", () => updatesService.checkForUpdates());
  ipcMain.handle("updates:download", () => updatesService.downloadUpdate());
  ipcMain.handle("updates:quitAndInstall", () => updatesService.quitAndInstall());
  ipcMain.handle("updates:getStatus", () => updatesService.getStatus());

}

export function unregisterUpdatesIpc() {
  ipcMain.removeHandler("updates:check");
  ipcMain.removeHandler("updates:download");
  ipcMain.removeHandler("updates:quitAndInstall");
  ipcMain.removeHandler("updates:getStatus");
}
