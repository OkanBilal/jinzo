import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

// ─────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────
function logInfo(...args: unknown[]): void {
  console.log("[ProvidersUtils]", ...args);
}

function logWarn(...args: unknown[]): void {
  console.warn("[ProvidersUtils]", ...args);
}

// ─────────────────────────────────────────────────────────────
// CLI Binary Discovery
// ─────────────────────────────────────────────────────────────

const isWindows = process.platform === "win32";

// Cached CLI path
let cachedCliPath: string | null = null;

/**
 * Check if a path points to an executable file (NOT a directory)
 */
export function isExecutableFile(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    const stat = fs.statSync(p);

    // Explicitly reject directories - this is critical
    if (stat.isDirectory()) {
      return false;
    }
    if (!stat.isFile()) {
      return false;
    }
    if (isWindows) {
      // On Windows, check for common executable extensions or trust existence
      const ext = path.extname(p).toLowerCase();
      return ext === ".exe" || ext === ".cmd" || ext === ".bat" || ext === "";
    } else {
      // On Unix, check execute permission
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

/**
 * Resolve a candidate path and validate it's an executable.
 * Important: Returns the ORIGINAL path (e.g., symlink) if valid, not the resolved path.
 * This is because the Claude SDK may expect paths ending in "claude".
 */
export function resolveCandidate(p: string): string | null {
  try {
    if (!fs.existsSync(p)) {
      return null;
    }

    // Resolve symlinks to get the real path for validation
    const realPath = fs.realpathSync(p);

    // Check the real path stat
    const stat = fs.statSync(realPath);

    // If the target is an executable file, return the ORIGINAL path
    // (preserves symlink paths like ~/.local/bin/claude which the SDK may expect)
    if (stat.isFile() && isExecutableFile(realPath)) {
      return p;
    }

    // Special case: if the resolved path is a directory, look inside for executable
    if (stat.isDirectory()) {
      const executableCandidates = isWindows
        ? [
            path.join(realPath, "claude.exe"),
            path.join(realPath, "bin", "claude.exe"),
            path.join(realPath, "claude.cmd"),
            path.join(realPath, "bin", "claude.cmd"),
          ]
        : [path.join(realPath, "claude"), path.join(realPath, "bin", "claude")];

      for (const execPath of executableCandidates) {
        if (isExecutableFile(execPath)) {
          return execPath;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Compare version strings for sorting (descending order)
 */
export function compareVersionsDesc(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return bVal - aVal; // Descending order
  }
  return 0;
}

/**
 * Clear the cached CLI path (useful for testing or after installation)
 */
export function clearClaudeCliCache(): void {
  cachedCliPath = null;
}

/**
 * Find the Claude CLI binary path
 * The SDK needs the path to the installed `claude` command
 * ALWAYS returns the full path to the executable file, never a directory
 */
export function findClaudeBinary(): string | null {
  if (cachedCliPath) {
    try {
      const stat = fs.statSync(cachedCliPath);
      if (stat.isFile()) {
        return cachedCliPath;
      } else {
        logWarn(
          "Cached CLI path is not a file, clearing cache:",
          cachedCliPath,
        );
        cachedCliPath = null;
      }
    } catch {
      cachedCliPath = null;
    }
  }

  const homeDir = os.homedir();

  // ─────────────────────────────────────────────────────────────
  // 1. Check Anthropic installer's versioned directory first
  // ─────────────────────────────────────────────────────────────
  const versionsDir = path.join(
    homeDir,
    ".local",
    "share",
    "claude",
    "versions",
  );
  try {
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir).filter((v) => {
        // Filter to only version-like directories
        return /^\d+/.test(v);
      });

      if (versions.length > 0) {
        const sortedVersions = versions.sort(compareVersionsDesc);

        for (const version of sortedVersions) {
          const versionDir = path.join(versionsDir, version);

          // Check candidate executable paths within the version directory
          const candidates = isWindows
            ? [
                path.join(versionDir, "claude.exe"),
                path.join(versionDir, "bin", "claude.exe"),
                path.join(versionDir, "claude.cmd"),
                path.join(versionDir, "bin", "claude.cmd"),
              ]
            : [
                path.join(versionDir, "claude"),
                path.join(versionDir, "bin", "claude"),
              ];

          for (const candidate of candidates) {
            const resolved = resolveCandidate(candidate);
            if (resolved) {
              logInfo("Found Claude CLI version:", version, "at:", resolved);
              cachedCliPath = resolved;
              return resolved;
            }
          }
        }
      }
    }
  } catch {}

  // ─────────────────────────────────────────────────────────────
  // 2. Check common fixed installation paths
  // ─────────────────────────────────────────────────────────────
  const commonPaths: string[] = [];

  if (isWindows) {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";

    commonPaths.push(
      path.join(localAppData, "Programs", "Claude", "claude.exe"),
      path.join(localAppData, "Programs", "Claude", "bin", "claude.exe"),
      path.join(programFiles, "Claude", "claude.exe"),
      path.join(programFiles, "Claude", "bin", "claude.exe"),
      path.join(homeDir, ".local", "bin", "claude.exe"),
      path.join(homeDir, ".npm-global", "bin", "claude.cmd"),
    );
  } else {
    commonPaths.push(
      path.join(homeDir, ".local", "bin", "claude"),
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
      "/usr/bin/claude",
      path.join(homeDir, ".npm-global", "bin", "claude"),
    );
  }

  for (const binPath of commonPaths) {
    const resolved = resolveCandidate(binPath);
    if (resolved) {
      logInfo("Found Claude CLI at:", resolved);
      cachedCliPath = resolved;
      return resolved;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PATH fallback: use which/where command
  // ─────────────────────────────────────────────────────────────
  try {
    const cmd = isWindows ? "where" : "which";
    const result = execFileSync(cmd, ["claude"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Take the first non-empty line
    const lines = result
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    if (lines.length > 0) {
      const resolved = resolveCandidate(lines[0].trim());
      if (resolved) {
        logInfo("Found Claude CLI in PATH:", resolved);
        cachedCliPath = resolved;
        return resolved;
      }
    }
  } catch {}

  logWarn("Claude CLI not found in any known location");
  return null;
}
