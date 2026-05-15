import { ipcMain } from "electron";
import { statsService } from "./stats.service";

export function registerStatsIpc(): void {
  ipcMain.handle("stats:getDashboard", async (_event, filter?: string) => {
    return statsService.getDashboard(filter as any);
  });
}

export function unregisterStatsIpc(): void {
  ipcMain.removeHandler("stats:getDashboard");
}
