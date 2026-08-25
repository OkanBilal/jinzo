import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { backendService } from "./backend.service";

// Registered through the ipcMain shim (not raw Electron ipcMain) so the handler
// lands in the registry the WS router serves: a phone or another mains reaches
// `backend:describe` over the wire, and it is the first thing they ask.
export function registerBackendIpc() {
  ipcMain.handle(
    CHANNELS.backend.describe,
    handle(() => backendService.describe()),
  );
}

export function unregisterBackendIpc() {
  ipcMain.removeHandler(CHANNELS.backend.describe);
}
