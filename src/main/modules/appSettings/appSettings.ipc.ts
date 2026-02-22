import { ipcMain } from "electron";
import { appSettingsController } from "./appSettings.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAppSettingsIpc() {
  ipcMain.handle("appSettings:get", () => appSettingsController.get());
  ipcMain.handle("appSettings:setActiveMood", (_, moodId) => appSettingsController.setActiveMood(moodId));
  ipcMain.handle("appSettings:setEnableWorktrees", (_, enabled) => appSettingsController.setEnableWorktrees(enabled));
  ipcMain.handle("appSettings:setShowToolCalls", (_, enabled) => appSettingsController.setShowToolCalls(enabled));
  ipcMain.handle("appSettings:setPreventSleepDuringRuns", (_, enabled) => appSettingsController.setPreventSleepDuringRuns(enabled));

  console.log("App settings IPC handlers registered");
}

export function unregisterAppSettingsIpc() {
  ipcMain.removeHandler("appSettings:get");
  ipcMain.removeHandler("appSettings:setActiveMood");
  ipcMain.removeHandler("appSettings:setEnableWorktrees");
  ipcMain.removeHandler("appSettings:setShowToolCalls");
  ipcMain.removeHandler("appSettings:setPreventSleepDuringRuns");
}
