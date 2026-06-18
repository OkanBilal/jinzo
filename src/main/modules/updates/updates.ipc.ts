import { ipcMain } from "../../ipc-kit/ipc-main";
import { updatesService } from "./updates.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Handlers - Thin layer, just registers handlers
// ─────────────────────────────────────────────────────────────
export function registerUpdatesIpc() {
  ipcMain.handle(CHANNELS.updates.check, () => updatesService.checkForUpdates());
  ipcMain.handle(CHANNELS.updates.download, () => updatesService.downloadUpdate());
  ipcMain.handle(CHANNELS.updates.quitAndInstall, () => updatesService.quitAndInstall());
  ipcMain.handle(CHANNELS.updates.getStatus, () => updatesService.getStatus());

}

export function unregisterUpdatesIpc() {
  ipcMain.removeHandler(CHANNELS.updates.check);
  ipcMain.removeHandler(CHANNELS.updates.download);
  ipcMain.removeHandler(CHANNELS.updates.quitAndInstall);
  ipcMain.removeHandler(CHANNELS.updates.getStatus);
}
