import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { ipcMain, BrowserWindow } from "electron";
import { terminalService } from "./terminal.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerTerminalIpc(): void {
  ipcMain.handle(
    CHANNELS.terminal.create,
    async (event, payload: { id: string; cwd: string }) => {
      try {
        const webContents = event.sender;
        const window = BrowserWindow.fromWebContents(webContents);

        terminalService.create(payload.id, payload.cwd, (id, data) => {
          if (window && !window.isDestroyed()) {
            webContents.send(CHANNELS.terminal.data, { id, data });
          }
        });

        return ok(undefined);
      } catch (err) {
        console.error("[Terminal] Failed to create terminal:", err);
        return fail(err instanceof Error ? err.message : "Failed to create terminal");
      }
    },
  );

  ipcMain.handle(CHANNELS.terminal.write, async (_, id: string, data: string) => {
    terminalService.write(id, data);
    return ok(undefined);
  });

  ipcMain.handle(
    CHANNELS.terminal.resize,
    async (_, id: string, cols: number, rows: number) => {
      terminalService.resize(id, cols, rows);
      return ok(undefined);
    },
  );

  ipcMain.handle(CHANNELS.terminal.destroy, async (_, id: string) => {
    terminalService.destroy(id);
    return ok(undefined);
  });
}

export function unregisterTerminalIpc(): void {
  ipcMain.removeHandler(CHANNELS.terminal.create);
  ipcMain.removeHandler(CHANNELS.terminal.write);
  ipcMain.removeHandler(CHANNELS.terminal.resize);
  ipcMain.removeHandler(CHANNELS.terminal.destroy);
}

export function destroyAllTerminals(): void {
  terminalService.destroyAll();
}
