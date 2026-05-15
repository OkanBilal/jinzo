import { ipcMain } from "electron";
import { connectionCredentialsService } from "./connectionCredentials.service";
import type { SaveCredentialsPayload } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Connection Credentials IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionCredentialsIpc() {
  // Save connection credentials
  ipcMain.handle(
    "connections:saveCredentials",
    async (_, payload: SaveCredentialsPayload) => {
      return connectionCredentialsService.saveCredentials(payload);
    }
  );

  // Check if credentials exist for a connection
  ipcMain.handle("connections:checkCredentials", async (_, provider: string) => {
    return connectionCredentialsService.checkCredentials(provider);
  });

}

export function unregisterConnectionCredentialsIpc() {
  ipcMain.removeHandler("connections:saveCredentials");
  ipcMain.removeHandler("connections:checkCredentials");
}
