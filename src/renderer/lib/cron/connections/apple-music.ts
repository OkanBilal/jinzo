import type { FeedItem } from "../../cron";
import {
  getConnectionWithTokens,
  getConnectionByProvider,
  getSelectedResources,
} from "../../cron/connection-utils";

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

function mapPlaylistToFeedItem(
  playlist: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  return {
    title: playlist.attributes.name,
    url: buildPlaylistUrl(playlist.id),
    description: playlist.attributes.description?.standard ?? null,
    date: normalizeDateToIso(playlist.attributes.dateAdded),
    source: "apple-music",
    imageUrl: processArtworkUrl(playlist.attributes.artwork?.url),
    metadata: { attributes: null },
    itemType: "apple-music-playlist",
    connectionId,
    resourceId,
  };
}

function mapTrackToFeedItem(
  track: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  return {
    title: track.attributes.name,
    url: track.attributes.url || buildSongUrl(track.id),
    description: `${track.attributes.artistName} - ${track.attributes.albumName}`,
    date: normalizeDateToIso(track.attributes.releasedDate),
    source: "apple-music",
    imageUrl: processArtworkUrl(track.attributes.artwork?.url),
    metadata: {
      artist: track.attributes.artistName,
      album: track.attributes.albumName,
      genres: track.attributes.genreNames,
    },
    itemType: "apple-music-track",
    connectionId,
    resourceId,
  };
}

export async function fetchPlaylists(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapPlaylistToFeedItem(pl, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Apple Music playlists:", error);
    return [];
  }
}

export async function fetchRecentlyPlayedTracks(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapTrackToFeedItem(item, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Apple Music recently played:", error);
    return [];
  }
}

export async function fetchHeavyRotation(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      // We'll primarily handle tracks and playlists
      if (item.type === "playlists") {
        return mapPlaylistToFeedItem(item, connectionId, resourceId);
      } else {
        // Default to track mapping for songs/albums
        return mapTrackToFeedItem(item, connectionId, resourceId);
      }
    });
  } catch (error) {
    console.error("Error fetching Apple Music heavy rotation:", error);
    return [];
  }
}

export async function fetchAppleMusicFromConnectionResources(): Promise<
  FeedItem[]
> {
  const connection = await getConnectionByProvider("apple-music");
  if (!connection) return [];

  const resources = await getSelectedResources(connection.id);
  if (resources.length === 0) return [];

  const allItems: FeedItem[] = [];

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
