import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import { gitService } from "../git/git.service";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MAX_UNTRACKED_INLINE_BYTES = 256 * 1024;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DiffSnapshot {
  baseRef: string;
  diffText: string;
  files: string[];
  untrackedFiles: string[];
  shortstat: string;
}

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Merge untracked file stats into a git shortstat string.
 * git diff --shortstat only covers tracked files; new files are added here.
 */
function mergeUntrackedIntoShortstat(
  shortstat: string,
  newFileCount: number,
  newInsertions: number,
): string {
  if (newFileCount === 0 && newInsertions === 0) return shortstat;
  const existingFiles = parseInt(shortstat.match(/(\d+) file/)?.[1] ?? "0", 10);
  const existingInsertions = parseInt(shortstat.match(/(\d+) insertion/)?.[1] ?? "0", 10);
  const existingDeletions = parseInt(shortstat.match(/(\d+) deletion/)?.[1] ?? "0", 10);
  const totalFiles = existingFiles + newFileCount;
  const totalInsertions = existingInsertions + newInsertions;
  const parts: string[] = [];
  parts.push(`${totalFiles} file${totalFiles !== 1 ? "s" : ""} changed`);
  if (totalInsertions > 0) {
    parts.push(`${totalInsertions} insertion${totalInsertions !== 1 ? "s" : ""}(+)`);
  }
  if (existingDeletions > 0) {
    parts.push(`${existingDeletions} deletion${existingDeletions !== 1 ? "s" : ""}(-)`);
  }
  return parts.join(", ");
}

// ─────────────────────────────────────────────────────────────
// Snapshot builder
// ─────────────────────────────────────────────────────────────

/**
 * Capture a unified diff between `baseRef` and the working tree at `rootPath`,
 * including synthetic hunks for untracked files (small text files inlined,
 * large/binary files stubbed). Returns null on git error.
 *
 * Used by RunSession's live/final diff capture and the manual resyncDiff
 * action triggered from the UI.
 */
export async function buildDiffSnapshot(params: {
  rootPath: string;
  baseRef: string;
}): Promise<DiffSnapshot | null> {
  const { rootPath, baseRef } = params;
  try {
    const [diffResult, filesResult, statResult, untrackedResult] = await Promise.all([
      gitService.getDiffSince(rootPath, baseRef),
      gitService.getChangedFilesSince(rootPath, baseRef),
      gitService.getShortStatSince(rootPath, baseRef),
      gitService.getUntrackedFiles(rootPath),
    ]);
    let diffText = diffResult.success ? (diffResult.data ?? "") : "";
    const trackedFiles = filesResult.success ? (filesResult.data ?? []) : [];
    const untrackedFiles = untrackedResult.success ? (untrackedResult.data ?? []) : [];
    let shortstat = statResult.success ? (statResult.data ?? "") : "";

    const files = [...new Set([...trackedFiles, ...untrackedFiles])];

    // Inline untracked file content as synthetic diff hunks.
    let untrackedInsertions = 0;
    if (untrackedFiles.length > 0) {
      const untrackedDiffs: string[] = [];
      for (const filePath of untrackedFiles) {
        const fullPath = path.join(rootPath, filePath);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > MAX_UNTRACKED_INLINE_BYTES) {
            untrackedDiffs.push(
              `diff --git a/${filePath} b/${filePath}\nnew file\nBinary or large file (${stat.size} bytes)`,
            );
            continue;
          }
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          untrackedInsertions += lines.length;
          const diffHeader = [
            `diff --git a/${filePath} b/${filePath}`,
            `new file mode 100644`,
            `--- /dev/null`,
            `+++ b/${filePath}`,
            `@@ -0,0 +1,${lines.length} @@`,
          ].join("\n");
          const diffBody = lines.map((l) => `+${l}`).join("\n");
          untrackedDiffs.push(`${diffHeader}\n${diffBody}`);
        } catch {
          untrackedDiffs.push(
            `diff --git a/${filePath} b/${filePath}\nnew file\n(could not read file)`,
          );
        }
      }
      if (untrackedDiffs.length > 0) {
        diffText = diffText
          ? `${diffText}\n${untrackedDiffs.join("\n")}`
          : untrackedDiffs.join("\n");
      }
    }

    if (untrackedInsertions > 0) {
      shortstat = mergeUntrackedIntoShortstat(
        shortstat,
        untrackedFiles.length,
        untrackedInsertions,
      );
    }

    return { baseRef, diffText, files, untrackedFiles, shortstat };
  } catch (err) {
    console.error(`[workspace-diff-snapshot] buildDiffSnapshot failed:`, err);
    return null;
  }
}
