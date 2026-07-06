import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import simpleGit from "simple-git";

// ─────────────────────────────────────────────────────────────
// Diff snapshot — the git module's deep diff-capture operation.
//
// `captureDiffSnapshot` is the only entry point; the four diff primitives
// below (diff-since, changed-files-since, shortstat-since, untracked-files)
// are the module's internal seam — used here and by the module's tests,
// never exported from the barrel. See CONTEXT.md "git module".
// ─────────────────────────────────────────────────────────────

const MAX_UNTRACKED_INLINE_BYTES = 256 * 1024;

export interface DiffSnapshot {
  baseRef: string;
  diffText: string;
  files: string[];
  untrackedFiles: string[];
  shortstat: string;
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Split a unified diff into per-file chunks and return filename → content hash.
 * Used to detect which files actually changed between two cumulative diffs
 * that share the same baseRef.
 */
export function buildPerFileDiffHashes(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!diffText) return result;
  const chunks = diffText.split(/^(?=diff --git )/m);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const match = chunk.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (match) {
      const fileName = match[2];
      result.set(fileName, hashContent(chunk));
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Internal diff primitives
// ─────────────────────────────────────────────────────────────

/** Unified diff since a base commit (staged + unstaged). */
async function diffSince(rootPath: string, baseSha: string): Promise<string> {
  return simpleGit(rootPath).diff([baseSha]);
}

/** Changed (tracked) files since a base commit. */
async function changedFilesSince(
  rootPath: string,
  baseSha: string,
): Promise<string[]> {
  const raw = await simpleGit(rootPath).diff(["--name-only", baseSha]);
  return raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

/** Shortstat summary since a base commit (tracked files only). */
async function shortStatSince(
  rootPath: string,
  baseSha: string,
): Promise<string> {
  const stat = await simpleGit(rootPath).diff(["--shortstat", baseSha]);
  return stat.trim();
}

/** Untracked files (new files not yet staged). */
async function untrackedFilesOf(rootPath: string): Promise<string[]> {
  const raw = await simpleGit(rootPath).raw([
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  return raw
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

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
 * large/binary files stubbed).
 *
 * All-or-throw: any git failure rejects instead of silently degrading fields
 * to ""/[], so an empty `diffText` always means "clean tree" — callers that
 * need "baseline unknown" semantics map the rejection themselves.
 */
export async function captureDiffSnapshot(
  rootPath: string,
  baseRef: string,
): Promise<DiffSnapshot> {
  const [rawDiff, trackedFiles, trackedShortstat, untrackedFiles] =
    await Promise.all([
      diffSince(rootPath, baseRef),
      changedFilesSince(rootPath, baseRef),
      shortStatSince(rootPath, baseRef),
      untrackedFilesOf(rootPath),
    ]);

  let diffText = rawDiff;
  let shortstat = trackedShortstat;
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
}
