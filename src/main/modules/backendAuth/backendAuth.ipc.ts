import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit/handle";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { backendAuthService } from "./backendAuth.service";

export function registerBackendAuthIpc(): void {
  ipcMain.handle(
    CHANNELS.backendAuth.setToken,
    handle((id: string, token: string) => backendAuthService.setToken(id, token)),
  );
  ipcMain.handle(
    CHANNELS.backendAuth.getToken,
    handle((id: string) => backendAuthService.getToken(id)),
  );
  ipcMain.handle(
    CHANNELS.backendAuth.deleteToken,
    handle((id: string) => backendAuthService.deleteToken(id)),
  );
}

export function unregisterBackendAuthIpc(): void {
  ipcMain.removeHandler(CHANNELS.backendAuth.setToken);
  ipcMain.removeHandler(CHANNELS.backendAuth.getToken);
  ipcMain.removeHandler(CHANNELS.backendAuth.deleteToken);
}
