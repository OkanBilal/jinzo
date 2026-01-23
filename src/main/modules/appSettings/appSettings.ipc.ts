import { ipcMain } from "electron";
import { appSettingsController } from "./appSettings.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAppSettingsIpc() {
  ipcMain.handle("appSettings:get", () => appSettingsController.get());
  ipcMain.handle("appSettings:setActiveMood", (_, moodId) => appSettingsController.setActiveMood(moodId));

  console.log("App settings IPC handlers registered");
}

export function unregisterAppSettingsIpc() {
  ipcMain.removeHandler("appSettings:get");
  ipcMain.removeHandler("appSettings:setActiveMood");
}
