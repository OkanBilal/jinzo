import { ipcMain } from "electron";
import { accountController } from "./account.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAccountIpc() {
  ipcMain.handle("account:get", () => accountController.get());
  ipcMain.handle("account:update", (_, payload) =>
    accountController.update(payload),
  );

}

export function unregisterAccountIpc() {
  ipcMain.removeHandler("account:get");
  ipcMain.removeHandler("account:update");
}
