// ─────────────────────────────────────────────────────────────
// Guards Controller
// ─────────────────────────────────────────────────────────────

import type { PackageIdentifier } from "./adapters/adapter.types";
import { guardsService } from "./guards.service";

export const guardsController = {
  getActiveGuard: () => guardsService.getActiveGuard(),

  checkPackage: (pkg: PackageIdentifier) => guardsService.checkPackage(pkg),

  checkPackages: (pkgs: PackageIdentifier[]) => guardsService.checkPackages(pkgs),

  getPackageScore: (pkg: PackageIdentifier) => guardsService.getPackageScore(pkg),

  scanWorkspace: (workspaceId: string, rootPath: string) =>
    guardsService.scanWorkspace(workspaceId, rootPath),
};
