import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { ipcMain, BrowserWindow } from "electron";
import { terminalService } from "./terminal.service";

const CHANNELS = {
  CREATE: "terminal:create",
  WRITE: "terminal:write",
  RESIZE: "terminal:resize",
  DESTROY: "terminal:destroy",
  DATA: "terminal:data",
} as const;

export function registerTerminalIpc(): void {
  ipcMain.handle(
    CHANNELS.CREATE,
    async (event, payload: { id: string; cwd: string }) => {
      try {
        const webContents = event.sender;
        const window = BrowserWindow.fromWebContents(webContents);

        terminalService.create(payload.id, payload.cwd, (id, data) => {
          if (window && !window.isDestroyed()) {
            webContents.send(CHANNELS.DATA, { id, data });
          }
        });

        return ok(undefined);
      } catch (err) {
        console.error("[Terminal] Failed to create terminal:", err);
        return fail(err instanceof Error ? err.message : "Failed to create terminal");
      }
    },
  );

  ipcMain.handle(CHANNELS.WRITE, async (_, id: string, data: string) => {
    terminalService.write(id, data);
    return ok(undefined);
  });

  ipcMain.handle(
    CHANNELS.RESIZE,
    async (_, id: string, cols: number, rows: number) => {
      terminalService.resize(id, cols, rows);
      return ok(undefined);
    },
  );

  ipcMain.handle(CHANNELS.DESTROY, async (_, id: string) => {
    terminalService.destroy(id);
    return ok(undefined);
  });
}

export function unregisterTerminalIpc(): void {
  ipcMain.removeHandler(CHANNELS.CREATE);
  ipcMain.removeHandler(CHANNELS.WRITE);
  ipcMain.removeHandler(CHANNELS.RESIZE);
  ipcMain.removeHandler(CHANNELS.DESTROY);
}

export function destroyAllTerminals(): void {
  terminalService.destroyAll();
}
