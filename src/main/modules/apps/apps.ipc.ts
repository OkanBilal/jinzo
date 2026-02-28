import { ipcMain } from "electron";
import { appsController } from "./apps.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAppsIpc() {
  ipcMain.handle("apps:getAll", () => appsController.getAll());
  ipcMain.handle("apps:updateById", (_, id, payload) => appsController.updateById(id, payload));

}

export function unregisterAppsIpc() {
  ipcMain.removeHandler("apps:getAll");
  ipcMain.removeHandler("apps:updateById");
}
