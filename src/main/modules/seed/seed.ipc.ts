import { ipcMain } from "electron";
import { seedService } from "./seed.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSeedIpc() {
  ipcMain.handle(CHANNELS.seed.accounts, () => seedService.seedAccounts());
  ipcMain.handle(CHANNELS.seed.connectionStates, () => seedService.seedConnectionStates());
  ipcMain.handle(CHANNELS.seed.connections, () => seedService.seedConnections());
  ipcMain.handle(CHANNELS.seed.providers, () => seedService.seedProviders());
  ipcMain.handle(CHANNELS.seed.spaces, () => seedService.seedSpaces());
  ipcMain.handle(CHANNELS.seed.all, () => seedService.seedAll());

}

export function unregisterSeedIpc() {
  ipcMain.removeHandler(CHANNELS.seed.accounts);
  ipcMain.removeHandler(CHANNELS.seed.connectionStates);
  ipcMain.removeHandler(CHANNELS.seed.connections);
  ipcMain.removeHandler(CHANNELS.seed.providers);
  ipcMain.removeHandler(CHANNELS.seed.spaces);
  ipcMain.removeHandler(CHANNELS.seed.all);
}
