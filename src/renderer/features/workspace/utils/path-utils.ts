/** Strip leading "./" or "/" from a path for comparison. */
export function normalizePath(path: string): string {
  return path.replace(/^\.?\//, "");
}

/** Check if two normalized paths refer to the same file (handles prefix differences). */
export function pathsMatch(a: string, b: string): boolean {
  return a === b || a.endsWith("/" + b) || b.endsWith("/" + a);
}
