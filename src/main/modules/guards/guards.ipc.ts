// ─────────────────────────────────────────────────────────────
// Guards IPC Handlers
// ─────────────────────────────────────────────────────────────

import { ipcMain } from "electron";
import type { PackageIdentifier } from "./adapters/adapter.types";
import { guardsService } from "./guards.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerGuardsIpc(): void {
  ipcMain.handle(CHANNELS.guards.getActiveGuard, async () => {
    return guardsService.getActiveGuard();
  });

  ipcMain.handle(
    CHANNELS.guards.checkPackage,
    async (_, pkg: PackageIdentifier) => {
      return guardsService.checkPackage(pkg);
    },
  );

  ipcMain.handle(
    CHANNELS.guards.checkPackages,
    async (_, pkgs: PackageIdentifier[]) => {
      return guardsService.checkPackages(pkgs);
    },
  );

  ipcMain.handle(
    CHANNELS.guards.getPackageScore,
    async (_, pkg: PackageIdentifier) => {
      return guardsService.getPackageScore(pkg);
    },
  );

  ipcMain.handle(
    CHANNELS.guards.scanWorkspace,
    async (_, workspaceId: string, rootPath: string) => {
      return guardsService.scanWorkspace(workspaceId, rootPath);
    },
  );
}

export function unregisterGuardsIpc(): void {
  [
    CHANNELS.guards.getActiveGuard,
    CHANNELS.guards.checkPackage,
    CHANNELS.guards.checkPackages,
    CHANNELS.guards.getPackageScore,
    CHANNELS.guards.scanWorkspace,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
