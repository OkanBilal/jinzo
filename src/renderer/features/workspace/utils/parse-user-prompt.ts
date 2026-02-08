export interface ParsedFile {
  fullPath: string;
  displayName: string;
}

export function parseUserPromptWithFiles(content: string): {
  message: string;
  files: ParsedFile[];
} {
  const files: ParsedFile[] = [];
  const foundRanges: Array<{ start: number; end: number; path: string }> = [];

  // Strategy: Find all /Users or /home occurrences, then find the next file extension after each
  const fileExtPattern =
    /\.(ts|tsx|js|jsx|json|md|css|html|sql|py|rs|go|java|cpp|hpp|yaml|yml|toml|xml|sh)(?=\s|$)/g;
  const pathStartPattern = /\/(?:Users|home)\//g;

  // Find all path starts
  const pathStarts: number[] = [];
  let startMatch;
  while ((startMatch = pathStartPattern.exec(content)) !== null) {
    pathStarts.push(startMatch.index);
  }

  // For each path start, find the next file extension
  for (const startIdx of pathStarts) {
    // Look for file extension after this start position
    fileExtPattern.lastIndex = startIdx;
    const extMatch = fileExtPattern.exec(content);

    if (extMatch && extMatch.index > startIdx) {
      const endIdx = extMatch.index + extMatch[0].length;
      const fullPath = content.substring(startIdx, endIdx);

      // Check this range doesn't overlap with existing ranges
      const overlaps = foundRanges.some(
        (r) =>
          (startIdx >= r.start && startIdx < r.end) ||
          (endIdx > r.start && endIdx <= r.end),
      );

      if (!overlaps) {
        foundRanges.push({ start: startIdx, end: endIdx, path: fullPath });

        // Get display name (parent/filename)
        const lastSlashIdx = fullPath.lastIndexOf("/");
        const fileName = fullPath.substring(lastSlashIdx + 1);
        const pathWithoutFile = fullPath.substring(0, lastSlashIdx);
        const parentSlashIdx = pathWithoutFile.lastIndexOf("/");
        const parentFolder = pathWithoutFile.substring(parentSlashIdx + 1);

        const displayName = parentFolder
          ? `${parentFolder}/${fileName}`
          : fileName;
        files.push({ fullPath, displayName });
      }
    }
  }

  // Remove all found paths from message (sort by position descending to preserve indices)
  let message = content;
  const sortedRanges = [...foundRanges].sort((a, b) => b.start - a.start);
  for (const range of sortedRanges) {
    message = message.substring(0, range.start) + message.substring(range.end);
  }

  // Clean up the message
  message = message
    .replace(/Use these files as context:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return { message, files };
}
