export function decryptToken(buffer: Buffer): string {
  // TODO: Implement proper decryption here
  return buffer.toString("utf-8");
}

export function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    playlists: "Library Playlists",
    "recently-played": "Recently Played",
    "heavy-rotation": "Heavy Rotation",
    "top-tracks": "Top Tracks",
    "top-artists": "Top Artists",
    "saved-albums": "Saved Albums",
  };
  return names[source] || source;
}

export function parseConnectionMetadata(
  metadata: string | object | null
): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return metadata as Record<string, any>;
}

export function parseResourceMetadata(
  metadata: string | null
): Record<string, any> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}
