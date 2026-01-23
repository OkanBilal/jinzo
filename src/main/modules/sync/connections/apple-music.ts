import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getConnectionByProvider,
  getSelectedResources,
} from "../sync.connection-utils";

const APPLE_MUSIC_API_BASE = "https://api.music.apple.com/v1";
const APPLE_MUSIC_SITE_BASE = "https://music.apple.com";
const DEFAULT_LIMIT = 5;
const HEAVY_ROTATION_LIMIT = 10;
const ARTWORK_SIZE = "400x400";
const ARTWORK_PLACEHOLDER = "{w}x{h}";

async function getCredentials(): Promise<{
  developerToken: string;
  userToken: string;
} | null> {
  const connection = await getConnectionWithTokens("apple-music");
  if (!connection?.accessToken || !connection?.refreshToken) return null;

  return {
    developerToken: connection.accessToken,
    userToken: connection.refreshToken,
  };
}

function getAppleMusicHeaders(credentials: {
  developerToken: string;
  userToken: string;
}): HeadersInit {
  return {
    Authorization: `Bearer ${credentials.developerToken}`,
    "Music-User-Token": credentials.userToken,
  };
}

function buildPlaylistUrl(playlistId: string): string {
  return `${APPLE_MUSIC_SITE_BASE}/library/playlist/${playlistId}`;
}

function buildSongUrl(songId: string): string {
  return `${APPLE_MUSIC_SITE_BASE}/song/${songId}`;
}

function processArtworkUrl(artworkUrl: string | undefined): string | null {
  if (!artworkUrl) return null;
  return artworkUrl.replace(ARTWORK_PLACEHOLDER, ARTWORK_SIZE);
}

function normalizeDateToIso(dateString: string | undefined): string {
  if (!dateString) return new Date().toISOString();
  return new Date(dateString).toISOString();
}

function mapPlaylistToEntityInput(
  playlist: any,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  return {
    kind: "apple_music_playlist",
    title: playlist.attributes.name,
    url: buildPlaylistUrl(playlist.id),
    body: playlist.attributes.description?.standard ?? null,
    summary: playlist.attributes.description?.standard?.substring(0, 500) || null,
    occurredAt: normalizeDateToIso(playlist.attributes.dateAdded),
    externalId: playlist.id,
    connectionId,
    resourceId,
    metadata: {
      imageUrl: processArtworkUrl(playlist.attributes.artwork?.url),
    },
  };
}

function mapTrackToEntityInput(
  track: any,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  const description = `${track.attributes.artistName} - ${track.attributes.albumName}`;
  return {
    kind: "apple_music_track",
    title: track.attributes.name,
    url: track.attributes.url || buildSongUrl(track.id),
    body: description,
    summary: description,
    occurredAt: normalizeDateToIso(track.attributes.releasedDate),
    externalId: track.id,
    connectionId,
    resourceId,
    metadata: {
      artist: track.attributes.artistName,
      album: track.attributes.albumName,
      genres: track.attributes.genreNames,
      imageUrl: processArtworkUrl(track.attributes.artwork?.url),
    },
  };
}

export async function fetchPlaylists(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Apple Music credentials not configured");
      return [];
    }

    const res = await fetch(
      `${APPLE_MUSIC_API_BASE}/me/library/playlists?limit=${DEFAULT_LIMIT}`,
      { headers: getAppleMusicHeaders(credentials) }
    );

    if (!res.ok) {
      console.error("Apple Music API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.data.map((pl: any) =>
      mapPlaylistToEntityInput(pl, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Apple Music playlists:", error);
    return [];
  }
}

export async function fetchRecentlyPlayedTracks(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Apple Music credentials not configured");
      return [];
    }

    const res = await fetch(
      `${APPLE_MUSIC_API_BASE}/me/recent/played/tracks?limit=${DEFAULT_LIMIT}`,
      { headers: getAppleMusicHeaders(credentials) }
    );

    if (!res.ok) {
      console.error(
        "Apple Music Recently Played API error:",
        res.status,
        await res.text()
      );
      return [];
    }

    const data = await res.json();
    return data.data.map((item: any) =>
      mapTrackToEntityInput(item, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Apple Music recently played:", error);
    return [];
  }
}

export async function fetchHeavyRotation(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Apple Music credentials not configured");
      return [];
    }

    const res = await fetch(
      `${APPLE_MUSIC_API_BASE}/me/history/heavy-rotation?limit=${HEAVY_ROTATION_LIMIT}`,
      { headers: getAppleMusicHeaders(credentials) }
    );

    if (!res.ok) {
      console.error(
        "Apple Music Heavy Rotation API error:",
        res.status,
        await res.text()
      );
      return [];
    }

    const data = await res.json();
    return data.data.map((item: any) => {
      // Heavy rotation can contain different types (albums, playlists, tracks)
      if (item.type === "playlists") {
        return mapPlaylistToEntityInput(item, connectionId, resourceId);
      } else {
        return mapTrackToEntityInput(item, connectionId, resourceId);
      }
    });
  } catch (error) {
    console.error("Error fetching Apple Music heavy rotation:", error);
    return [];
  }
}

export async function fetchAppleMusicFromConnectionResources(): Promise<
  EntityInput[]
> {
  const connection = await getConnectionByProvider("apple-music");
  if (!connection) return [];

  const resources = await getSelectedResources(connection.id);
  if (resources.length === 0) return [];

  const allItems: EntityInput[] = [];

  for (const resource of resources) {
    const sourceType = resource.externalId;

    if (sourceType === "playlists") {
      const items = await fetchPlaylists(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "recently-played") {
      const items = await fetchRecentlyPlayedTracks(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "heavy-rotation") {
      const items = await fetchHeavyRotation(connection.id, resource.id);
      allItems.push(...items);
    }
  }

  return allItems;
}
