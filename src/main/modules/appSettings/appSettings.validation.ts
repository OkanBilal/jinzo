// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────
export function validateSpaceId(spaceId: unknown): { value: string | null; error: string | null } {
  if (spaceId === null || spaceId === undefined) {
    return { value: null, error: null };
  }

  if (typeof spaceId !== "string") {
    return { value: null, error: "spaceId must be a string or null" };
  }

  return { value: spaceId, error: null };
}
