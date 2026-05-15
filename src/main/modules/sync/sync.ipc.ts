import { ipcMain } from "electron";
import { syncService } from "./sync.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSyncIpc() {
  ipcMain.handle(CHANNELS.sync.runEntitySync, (_, provider?: string) => syncService.runEntitySync(provider));

}

export function unregisterSyncIpc() {
  ipcMain.removeHandler(CHANNELS.sync.runEntitySync);
}
