import { ipcMain } from "electron";
import { ConnectionStatesController } from "./connectionStates.controller";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionStatesIpc() {
  ipcMain.handle("connectionStates:getAll", () => ConnectionStatesController.getAll());
  ipcMain.handle("connectionStates:updateById", (_, id, payload) => ConnectionStatesController.updateById(id, payload));

}

export function unregisterConnectionStatesIpc() {
  ipcMain.removeHandler("connectionStates:getAll");
  ipcMain.removeHandler("connectionStates:updateById");
}
