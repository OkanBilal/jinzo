import { ipcMain } from "electron";
import { seedController } from "./seed.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSeedIpc() {
  ipcMain.handle("seed:apps", () => seedController.seedApps());
  ipcMain.handle("seed:connections", () => seedController.seedConnections());
  ipcMain.handle("seed:all", () => seedController.seedAll());

  console.log("Seed IPC handlers registered");
}

export function unregisterSeedIpc() {
  ipcMain.removeHandler("seed:apps");
  ipcMain.removeHandler("seed:connections");
  ipcMain.removeHandler("seed:all");
}
