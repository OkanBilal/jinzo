// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────
export function validateMoodId(moodId: unknown): { value: string | null; error: string | null } {
  if (moodId === null || moodId === undefined) {
    return { value: null, error: null };
  }

  if (typeof moodId !== "string") {
    return { value: null, error: "moodId must be a string or null" };
  }

  return { value: moodId, error: null };
}
