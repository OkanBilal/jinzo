import { ipcMain } from "electron";
import { accountService } from "./account.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerAccountIpc() {
  ipcMain.handle("account:get", () => accountService.getAccount());
  ipcMain.handle("account:update", (_, payload) =>
    accountService.updateAccount(payload),
  );

}

export function unregisterAccountIpc() {
  ipcMain.removeHandler("account:get");
  ipcMain.removeHandler("account:update");
}
