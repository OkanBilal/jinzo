export function serializeLabels(labels?: string[]): string | null {
  if (!labels || labels.length === 0) return null;
  return JSON.stringify(labels);
}

export function serializeMetadata(
  metadata?: Record<string, unknown>
): string | null {
  if (!metadata) return null;
  return JSON.stringify(metadata);
}
