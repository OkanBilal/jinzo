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
// PATH Augmentation for Packaged App
// ─────────────────────────────────────────────────────────────

/**
 * Augment process.env.PATH with common macOS binary directories.
 * Packaged macOS apps launched from Finder/Dock get a minimal PATH
 * (/usr/bin:/bin:/usr/sbin:/sbin), missing user-installed binaries.
 * Call this early in app startup, before any provider initialization.
 */
export function augmentPathForPackagedApp(): void {
  const homeDir = os.homedir();
  const additionalPaths = [
    path.join(homeDir, ".local", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    path.join(homeDir, ".nvm", "current", "bin"),
    path.join(homeDir, ".npm-global", "bin"),
  ];

  const currentPath = process.env.PATH || "";
  const currentDirs = new Set(currentPath.split(path.delimiter));

  const newDirs = additionalPaths.filter((d) => !currentDirs.has(d));
  if (newDirs.length > 0) {
    process.env.PATH = currentPath + path.delimiter + newDirs.join(path.delimiter);
    logInfo("Augmented PATH with:", newDirs.join(", "));
  }
}

// ─────────────────────────────────────────────────────────────
// Environment Diagnostics
// ─────────────────────────────────────────────────────────────

let diagnosticsLogged = false;

/**
 * Log environment diagnostics once. Useful for debugging packaged app issues.
 */
// function logEnvironmentDiagnostics(): void {
//   if (diagnosticsLogged) return;
//   diagnosticsLogged = true;

//   try {
//     const { app } = require("electron");
//     logInfo("=== Environment Diagnostics ===");
//     logInfo("app.isPackaged:", app.isPackaged);
//     logInfo("process.cwd():", process.cwd());
//     logInfo("process.execPath:", process.execPath);
//     logInfo("process.resourcesPath:", process.resourcesPath);
//     logInfo("app.getAppPath():", app.getAppPath());
//     logInfo("PATH:", process.env.PATH);
//     logInfo("HOME:", process.env.HOME);
//     logInfo("SHELL:", process.env.SHELL);
//     logInfo("=== End Diagnostics ===");
//   } catch (e) {
//     logWarn("Failed to log diagnostics:", e);
//   }
// }

// ─────────────────────────────────────────────────────────────
// CLI Binary Discovery
// ─────────────────────────────────────────────────────────────

const isWindows = process.platform === "win32";

// Cached CLI paths
let cachedCliPath: string | null = null;
let cachedCopilotCliPath: string | null = null;

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
  //logEnvironmentDiagnostics();

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
      //logInfo("Found Claude CLI at:", resolved);
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

/**
 * Find the Copilot CLI binary for the Copilot SDK.
 *
 * The SDK's internal `getBundledCliPath()` uses `import.meta.resolve()` which
 * breaks in bundled CJS / packaged Electron contexts.
 *
 * Additionally, when `cliPath` ends with `.js`, the SDK spawns it via
 * `process.execPath` (the Electron binary), which fails because the
 * `RunAsNode` fuse is disabled in the packaged app.
 *
 * Solution: resolve the **native** platform binary from `@github/copilot-{platform}-{arch}`
 * and pass it directly. The SDK spawns non-JS paths as standalone executables.
 */
export function findCopilotCliPath(): string | null {
  // In development, the SDK's own getBundledCliPath() works fine:
  // it uses import.meta.resolve() + process.execPath (Electron as Node).
  // RunAsNode fuse is only enforced in packaged builds, so dev is fine.
  // Return null to let the SDK use its default resolution.
  try {
    const { app } = require("electron");
    if (!app.isPackaged) {
      return null;
    }
  } catch {
    return null;
  }

  if (cachedCopilotCliPath) {
    if (fs.existsSync(cachedCopilotCliPath)) {
      return cachedCopilotCliPath;
    }
    cachedCopilotCliPath = null;
  }

  const platform = process.platform;
  const arch = process.arch;
  // The native binary package, e.g. "@github/copilot-darwin-arm64"
  const nativePkg = `@github/copilot-${platform}-${arch}`;
  // The binary name inside the package
  const binaryName = platform === "win32" ? "copilot.exe" : "copilot";

  const { app } = require("electron");
  const appPath = app.getAppPath();

  const candidates: string[] = [
    // Unpacked ASAR location (native binaries must be outside ASAR to execute)
    path.join(appPath + ".unpacked", ".vite", "build", "node_modules", nativePkg, binaryName),
    // Inside ASAR (in case unpackDir covers it transparently)
    path.join(appPath, ".vite", "build", "node_modules", nativePkg, binaryName),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          logInfo("Found Copilot native binary at:", candidate);
          cachedCopilotCliPath = candidate;
          return candidate;
        }
      }
    } catch {}
  }

  logWarn(`Copilot native binary (${nativePkg}/${binaryName}) not found in packaged app`);
  return null;
}
