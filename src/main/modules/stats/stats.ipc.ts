import { ipcMain } from "electron";
import { statsController } from "./stats.controller";

export function registerStatsIpc(): void {
  ipcMain.handle("stats:getDashboard", async (_event, filter?: string) => {
    return statsController.getDashboard(filter as any);
  });
}

export function unregisterStatsIpc(): void {
  ipcMain.removeHandler("stats:getDashboard");
}
