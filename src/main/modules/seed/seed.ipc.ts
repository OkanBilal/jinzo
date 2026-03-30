import { ipcMain } from "electron";
import { seedController } from "./seed.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSeedIpc() {
  ipcMain.handle("seed:accounts", () => seedController.seedAccounts());
  ipcMain.handle("seed:connectionStates", () => seedController.seedConnectionStates());
  ipcMain.handle("seed:connections", () => seedController.seedConnections());
  ipcMain.handle("seed:providers", () => seedController.seedProviders());
  ipcMain.handle("seed:spaces", () => seedController.seedSpaces());
  ipcMain.handle("seed:all", () => seedController.seedAll());

}

export function unregisterSeedIpc() {
  ipcMain.removeHandler("seed:accounts");
  ipcMain.removeHandler("seed:connectionStates");
  ipcMain.removeHandler("seed:connections");
  ipcMain.removeHandler("seed:providers");
  ipcMain.removeHandler("seed:spaces");
  ipcMain.removeHandler("seed:all");
}
