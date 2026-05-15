import { ipcMain } from "electron";
import { syncService } from "./sync.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSyncIpc() {
  ipcMain.handle("sync:runEntitySync", (_, provider?: string) => syncService.runEntitySync(provider));

}

export function unregisterSyncIpc() {
  ipcMain.removeHandler("sync:runEntitySync");
}
