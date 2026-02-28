import { ipcMain } from "electron";
import { connectionCredentialsController } from "./connectionCredentials.controller";
import type { SaveCredentialsPayload } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Connection Credentials IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionCredentialsIpc() {
  // Save connection credentials
  ipcMain.handle(
    "connections:saveCredentials",
    async (_, payload: SaveCredentialsPayload) => {
      return connectionCredentialsController.saveCredentials(payload);
    }
  );

  // Check if credentials exist for a connection
  ipcMain.handle("connections:checkCredentials", async (_, provider: string) => {
    return connectionCredentialsController.checkCredentials(provider);
  });

}

export function unregisterConnectionCredentialsIpc() {
  ipcMain.removeHandler("connections:saveCredentials");
  ipcMain.removeHandler("connections:checkCredentials");
}
