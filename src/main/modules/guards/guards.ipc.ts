// ─────────────────────────────────────────────────────────────
// Guards IPC Handlers
// ─────────────────────────────────────────────────────────────

import { ipcMain } from "electron";
import type { PackageIdentifier } from "./adapters/adapter.types";
import { guardsService } from "./guards.service";

const CHANNELS = {
  GET_ACTIVE_GUARD: "guards:getActiveGuard",
  CHECK_PACKAGE: "guards:checkPackage",
  CHECK_PACKAGES: "guards:checkPackages",
  GET_PACKAGE_SCORE: "guards:getPackageScore",
  SCAN_WORKSPACE: "guards:scanWorkspace",
} as const;

export function registerGuardsIpc(): void {
  ipcMain.handle(CHANNELS.GET_ACTIVE_GUARD, async () => {
    return guardsService.getActiveGuard();
  });

  ipcMain.handle(
    CHANNELS.CHECK_PACKAGE,
    async (_, pkg: PackageIdentifier) => {
      return guardsService.checkPackage(pkg);
    },
  );

  ipcMain.handle(
    CHANNELS.CHECK_PACKAGES,
    async (_, pkgs: PackageIdentifier[]) => {
      return guardsService.checkPackages(pkgs);
    },
  );

  ipcMain.handle(
    CHANNELS.GET_PACKAGE_SCORE,
    async (_, pkg: PackageIdentifier) => {
      return guardsService.getPackageScore(pkg);
    },
  );

  ipcMain.handle(
    CHANNELS.SCAN_WORKSPACE,
    async (_, workspaceId: string, rootPath: string) => {
      return guardsService.scanWorkspace(workspaceId, rootPath);
    },
  );
}

export function unregisterGuardsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
