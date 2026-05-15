// ─────────────────────────────────────────────────────────────
// Guards Service
// Business logic for dependency security checks and hook building
// ─────────────────────────────────────────────────────────────

import type {
  PackageIdentifier,
  PackageCheckResult,
  PackageScore,
  ManifestScanResult,
} from "./adapters/adapter.types";
import { getActiveGuard, getActiveGuardInfo } from "./adapters/adapter.factory";
import { parseInstallCommand } from "./guards.utils";
import { workspaceActivityService } from "../workspaceActivity/workspaceActivity.service";

import type { ServiceResponse } from "../../../shared/ipc-kit/service-response";
export type { ServiceResponse };

export const guardsService = {
  /**
   * Get info about the active guard provider
   */
  getActiveGuard(): ServiceResponse<{ id: string; displayName: string } | null> {
    const info = getActiveGuardInfo();
    return { success: true, data: info };
  },

  /**
   * Check a single package
   */
  async checkPackage(pkg: PackageIdentifier): Promise<ServiceResponse<PackageCheckResult>> {
    try {
      const adapter = await getActiveGuard();
      if (!adapter) {
        return { success: false, error: "No guard service is connected" };
      }

      const result = await adapter.checkPackage(pkg);
      return { success: true, data: result };
    } catch (error: any) {
      console.error("[Guards] checkPackage failed:", error);
      return { success: false, error: error?.message || "Failed to check package" };
    }
  },

  /**
   * Batch check multiple packages
   */
  async checkPackages(pkgs: PackageIdentifier[]): Promise<ServiceResponse<PackageCheckResult[]>> {
    try {
      const adapter = await getActiveGuard();
      if (!adapter) {
        return { success: false, error: "No guard service is connected" };
      }

      const results = await adapter.checkPackages(pkgs);
      return { success: true, data: results };
    } catch (error: any) {
      console.error("[Guards] checkPackages failed:", error);
      return { success: false, error: error?.message || "Failed to check packages" };
    }
  },

  /**
   * Get detailed score for a package
   */
  async getPackageScore(pkg: PackageIdentifier): Promise<ServiceResponse<PackageScore>> {
    try {
      const adapter = await getActiveGuard();
      if (!adapter) {
        return { success: false, error: "No guard service is connected" };
      }

      const score = await adapter.getPackageScore(pkg);
      return { success: true, data: score };
    } catch (error: any) {
      console.error("[Guards] getPackageScore failed:", error);
      return { success: false, error: error?.message || "Failed to get package score" };
    }
  },

  /**
   * Check a raw command string for explicit package additions.
   * Used by Codex adapter which has no hook system — called inline.
   */
  async checkCommand(command: string): Promise<{ blocked: boolean; reason?: string }> {
    const parsed = parseInstallCommand(command);
    if (!parsed) return { blocked: false };

    try {
      const adapter = await getActiveGuard();
      if (!adapter) return { blocked: false };

      const guardInfo = getActiveGuardInfo();
      const results = await adapter.checkPackages(parsed.packages);
      const blocked = results.filter((r) => !r.allowed);

      if (blocked.length === 0) return { blocked: false };

      const details = blocked
        .map((b) => {
          const score = b.score ? ` (score: ${(b.score.overallScore * 100).toFixed(0)})` : "";
          return `${b.package.name}${score}: ${b.reason || "blocked"}`;
        })
        .join(", ");

      return {
        blocked: true,
        reason: `[Guard: ${guardInfo?.displayName}] Blocked: ${details}`,
      };
    } catch (error: any) {
      console.error("[Guards] checkCommand failed:", error);
      return { blocked: false };
    }
  },

  /**
   * Full scan of a workspace's dependencies
   */
  async scanWorkspace(
    workspaceId: string,
    rootPath: string,
  ): Promise<ServiceResponse<ManifestScanResult[]>> {
    try {
      const adapter = await getActiveGuard();
      if (!adapter) {
        return { success: false, error: "No guard service is connected" };
      }

      const results = await adapter.scanProject(rootPath);

      // Log to workspace activity
      if (results.length > 0) {
        const totalSummary = results.reduce(
          (acc, r) => ({
            total: acc.total + r.summary.total,
            critical: acc.critical + r.summary.critical,
            high: acc.high + r.summary.high,
            medium: acc.medium + r.summary.medium,
            low: acc.low + r.summary.low,
            safe: acc.safe + r.summary.safe,
          }),
          { total: 0, critical: 0, high: 0, medium: 0, low: 0, safe: 0 },
        );

        workspaceActivityService.log({
          workspaceId,
          type: "finding",
          title: `Dependency scan: ${totalSummary.total} packages`,
          summary: `${totalSummary.critical} critical, ${totalSummary.high} high, ${totalSummary.medium} medium risk`,
          metadata: {
            guard: adapter.id,
            summary: totalSummary,
            ecosystems: results.map((r) => r.ecosystem),
          },
        });
      }

      return { success: true, data: results };
    } catch (error: any) {
      console.error("[Guards] scanWorkspace failed:", error);
      return { success: false, error: error?.message || "Failed to scan workspace" };
    }
  },

  /**
   * Build a PreToolUse hook for the Claude Agent SDK that intercepts
   * explicit package additions and checks them against the active guard.
   *
   * Returns null if no guard is connected.
   */
  async buildClaudeGuardHook(): Promise<{
    matcher?: string;
    hooks: Array<(
      input: Record<string, unknown>,
      toolUseId: string | null,
      context: { signal: AbortSignal },
    ) => Promise<Record<string, unknown>>>;
    timeout?: number;
  } | null> {
    const guardInfo = getActiveGuardInfo();
    if (!guardInfo) return null;

    return {
      matcher: "Bash",
      timeout: 30,
      hooks: [
        async (
          input: Record<string, unknown>,
          _toolUseId: string | null,
          _context: { signal: AbortSignal },
        ): Promise<Record<string, unknown>> => {
          const toolInput = (input.tool_input as Record<string, unknown>) || {};
          const command = (toolInput.command as string) || "";

          const parsed = parseInstallCommand(command);
          if (!parsed) {
            return {};
          }

          try {
            const adapter = await getActiveGuard();
            if (!adapter) return {};

            const results = await adapter.checkPackages(parsed.packages);
            const blocked = results.filter((r) => !r.allowed);

            if (blocked.length === 0) {
              // All packages pass
              return {
                hookSpecificOutput: {
                  hookEventName: "PreToolUse",
                  additionalContext: `[Guard: ${guardInfo.displayName}] All ${results.length} package(s) passed security check.`,
                },
              };
            }

            // Block the command
            const blockedDetails = blocked
              .map((b) => {
                const score = b.score ? ` (score: ${(b.score.overallScore * 100).toFixed(0)})` : "";
                const alerts = b.alerts.length > 0
                  ? ` — ${b.alerts.map((a) => `${a.severity}: ${a.title}`).join(", ")}`
                  : "";
                return `  - ${b.package.name}${score}: ${b.reason || "blocked"}${alerts}`;
              })
              .join("\n");

            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason:
                  `[Guard: ${guardInfo.displayName}] Blocked ${blocked.length} package(s):\n${blockedDetails}\n\n` +
                  "Use a safer alternative or ask the user to override.",
              },
            };
          } catch (error: any) {
            console.error("[Guards] Hook check failed:", error);
            // On error, allow the command but warn
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: `[Guard: ${guardInfo.displayName}] Warning: security check failed (${error?.message}). Proceeding without check.`,
              },
            };
          }
        },
      ],
    };
  },

  /**
   * Build a pre-tool-use hook for the Copilot SDK.
   * Copilot uses a different hook signature than Claude.
   *
   * Returns null if no guard is connected.
   */
  async buildCopilotGuardHook(): Promise<((
    input: { toolName: string; toolArgs: unknown; timestamp: number; cwd: string },
  ) => Promise<{ permissionDecision?: "allow" | "deny"; permissionDecisionReason?: string } | void>) | null> {
    const guardInfo = getActiveGuardInfo();
    if (!guardInfo) return null;

    return async (input) => {
      // Only intercept Bash/shell tools
      const toolName = input.toolName.toLowerCase();
      if (toolName !== "bash" && toolName !== "shell" && toolName !== "run_command") {
        return;
      }

      let args = input.toolArgs as Record<string, unknown> | string | null;
      if (typeof args === "string") {
        try { args = JSON.parse(args); } catch { return; }
      }
      const argsObj = args as Record<string, unknown> | null;
      const command = (argsObj?.command as string) || (argsObj?.input as string) || "";
      if (!command) return;

      const parsed = parseInstallCommand(command);
      if (!parsed) return;

      try {
        const adapter = await getActiveGuard();
        if (!adapter) return;

        const results = await adapter.checkPackages(parsed.packages);
        const blocked = results.filter((r) => !r.allowed);

        if (blocked.length === 0) return;

        const names = blocked.map((b) => b.package.name).join(", ");
        return {
          permissionDecision: "deny" as const,
          permissionDecisionReason: `[${guardInfo.displayName}] Blocked: ${names}`,
        };
      } catch (error: any) {
        console.error("[Guards] Copilot hook check failed:", error);
        return;
      }
    };
  },
};
