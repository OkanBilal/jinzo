import { ipcMain } from "electron";
import { seedService } from "./seed.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSeedIpc() {
  ipcMain.handle("seed:accounts", () => seedService.seedAccounts());
  ipcMain.handle("seed:connectionStates", () => seedService.seedConnectionStates());
  ipcMain.handle("seed:connections", () => seedService.seedConnections());
  ipcMain.handle("seed:providers", () => seedService.seedProviders());
  ipcMain.handle("seed:spaces", () => seedService.seedSpaces());
  ipcMain.handle("seed:all", () => seedService.seedAll());

}

export function unregisterSeedIpc() {
  ipcMain.removeHandler("seed:accounts");
  ipcMain.removeHandler("seed:connectionStates");
  ipcMain.removeHandler("seed:connections");
  ipcMain.removeHandler("seed:providers");
  ipcMain.removeHandler("seed:spaces");
  ipcMain.removeHandler("seed:all");
}
