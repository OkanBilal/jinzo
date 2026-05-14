/**
 * Pure parsers for unified `git diff` output.
 * Kept renderer-side because we already have the raw diff text in the
 * `WorkspaceDiff` payload and don't want to round-trip per-file slicing
 * through IPC for what is essentially a regex split.
 */

/** Count insertions / deletions per file from a unified diff blob. */
export function parsePerFileStats(
  fullDiff: string,
): Record<string, { ins: number; del: number }> {
  const stats: Record<string, { ins: number; del: number }> = {};
  const fileSections = fullDiff.split(/(?=diff --git )/);
  for (const section of fileSections) {
    const headerMatch = section.match(/^diff --git a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];
    let ins = 0;
    let del = 0;
    const lines = section.split("\n");
    for (const line of lines) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      if (line.startsWith("+")) ins++;
      else if (line.startsWith("-")) del++;
    }
    stats[filePath] = { ins, del };
  }
  return stats;
}

/** Extract the diff section for a single file from a unified diff blob. */
export function parseFileDiffSegment(filePath: string, fullDiff: string): string {
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\n)diff --git a\\/${escapedPath} b\\/${escapedPath}[\\s\\S]*?(?=\\ndiff --git|$)`,
  );
  const match = fullDiff.match(pattern);
  return match ? match[0].trim() : "";
}
