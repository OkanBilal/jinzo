import { ipcMain } from "electron";
import { connectionCredentialsService } from "./connectionCredentials.service";
import type { SaveCredentialsPayload } from "./connectionCredentials.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// Connection Credentials IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionCredentialsIpc() {
  // Save connection credentials
  ipcMain.handle(
    CHANNELS.connections.saveCredentials,
    async (_, payload: SaveCredentialsPayload) => {
      return connectionCredentialsService.saveCredentials(payload);
    }
  );

  // Check if credentials exist for a connection
  ipcMain.handle(CHANNELS.connections.checkCredentials, async (_, provider: string) => {
    return connectionCredentialsService.checkCredentials(provider);
  });

}

export function unregisterConnectionCredentialsIpc() {
  ipcMain.removeHandler(CHANNELS.connections.saveCredentials);
  ipcMain.removeHandler(CHANNELS.connections.checkCredentials);
}
