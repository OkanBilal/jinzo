import { ipcMain } from "electron";
import { statsService } from "./stats.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerStatsIpc(): void {
  ipcMain.handle(CHANNELS.stats.getDashboard, async (_event, filter?: string) => {
    return statsService.getDashboard(filter as any);
  });
}

export function unregisterStatsIpc(): void {
  ipcMain.removeHandler(CHANNELS.stats.getDashboard);
}
