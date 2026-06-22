import { ipcMain } from "electron";
import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { localBackendService } from "./localBackend.service";

// Registered via the REAL electron ipcMain (NOT the `ipcMain` shim) so these
// control handlers stay local-only — a remote client riding the exposed WS host
// must never be able to toggle/stop the exposure it depends on.
export function registerLocalBackendIpc() {
  ipcMain.handle(CHANNELS.localBackend.getStatus, () =>
    ok(localBackendService.getStatus()),
  );

  ipcMain.handle(
    CHANNELS.localBackend.setRemoteAccess,
    async (_e, enabled: boolean, port?: number) => {
      try {
        return ok(await localBackendService.setRemoteAccess(enabled, port));
      } catch (error) {
        return fail(
          error instanceof Error ? error.message : "Failed to update remote access",
        );
      }
    },
  );

  ipcMain.handle(
    CHANNELS.localBackend.setLanAccess,
    async (_e, enabled: boolean) => {
      try {
        return ok(await localBackendService.setLanAccess(enabled));
      } catch (error) {
        return fail(
          error instanceof Error ? error.message : "Failed to update LAN access",
        );
      }
    },
  );

  ipcMain.handle(
    CHANNELS.localBackend.setTailscaleHttps,
    async (_e, enabled: boolean, httpsPort?: number) => {
      try {
        return ok(await localBackendService.setTailscaleHttps(enabled, httpsPort));
      } catch (error) {
        return fail(
          error instanceof Error ? error.message : "Failed to update Tailscale HTTPS",
        );
      }
    },
  );
}

export function unregisterLocalBackendIpc() {
  ipcMain.removeHandler(CHANNELS.localBackend.getStatus);
  ipcMain.removeHandler(CHANNELS.localBackend.setRemoteAccess);
  ipcMain.removeHandler(CHANNELS.localBackend.setLanAccess);
  ipcMain.removeHandler(CHANNELS.localBackend.setTailscaleHttps);
}
