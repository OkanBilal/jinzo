import { ipcMain } from "electron";
import { appSettingsService } from "./appSettings.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers — call service directly. appSettings has no
// controller layer because there's no coordination to add over
// the service (see CONTEXT.md "App settings").
// ─────────────────────────────────────────────────────────────
export function registerAppSettingsIpc() {
  ipcMain.handle("appSettings:get", () => appSettingsService.getSettings());
  ipcMain.handle("appSettings:update", (_, patch) =>
    appSettingsService.updateSettings(patch),
  );
}

export function unregisterAppSettingsIpc() {
  ipcMain.removeHandler("appSettings:get");
  ipcMain.removeHandler("appSettings:update");
}
