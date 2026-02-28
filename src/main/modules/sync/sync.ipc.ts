import { ipcMain } from "electron";
import { syncController } from "./sync.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerSyncIpc() {
  ipcMain.handle("sync:runEntitySync", (_, provider?: string) => syncController.runEntitySync(provider));

}

export function unregisterSyncIpc() {
  ipcMain.removeHandler("sync:runEntitySync");
}
