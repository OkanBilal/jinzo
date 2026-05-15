import { ipcMain } from "electron";
import { connectionStatesService } from "./connectionStates.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionStatesIpc() {
  ipcMain.handle(CHANNELS.connectionStates.getAll, () => connectionStatesService.getAll());
  ipcMain.handle(CHANNELS.connectionStates.updateById, (_, id, payload) => connectionStatesService.updateById(id, payload));

}

export function unregisterConnectionStatesIpc() {
  ipcMain.removeHandler(CHANNELS.connectionStates.getAll);
  ipcMain.removeHandler(CHANNELS.connectionStates.updateById);
}
