import { ipcMain } from "../../ipc-kit/ipc-main";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { backendAuthService } from "./backendAuth.service";

export function registerBackendAuthIpc(): void {
  ipcMain.handle(CHANNELS.backendAuth.setToken, async (_, id: string, token: string) => {
    return backendAuthService.setToken(id, token);
  });
  ipcMain.handle(CHANNELS.backendAuth.getToken, async (_, id: string) => {
    return backendAuthService.getToken(id);
  });
  ipcMain.handle(CHANNELS.backendAuth.deleteToken, async (_, id: string) => {
    return backendAuthService.deleteToken(id);
  });
}

export function unregisterBackendAuthIpc(): void {
  ipcMain.removeHandler(CHANNELS.backendAuth.setToken);
  ipcMain.removeHandler(CHANNELS.backendAuth.getToken);
  ipcMain.removeHandler(CHANNELS.backendAuth.deleteToken);
}
