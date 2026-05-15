import { ipcMain } from "electron";
import { connectionStatesService } from "./connectionStates.service";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionStatesIpc() {
  ipcMain.handle("connectionStates:getAll", () => connectionStatesService.getAll());
  ipcMain.handle("connectionStates:updateById", (_, id, payload) => connectionStatesService.updateById(id, payload));

}

export function unregisterConnectionStatesIpc() {
  ipcMain.removeHandler("connectionStates:getAll");
  ipcMain.removeHandler("connectionStates:updateById");
}
