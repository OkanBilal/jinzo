import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getConnectionByProvider,
  getSelectedResources,
} from "../sync.connection-utils";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const DEFAULT_LIMIT = 10;

async function getCredentials(): Promise<{
  accessToken: string;
} | null> {
  const connection = await getConnectionWithTokens("spotify");
  if (!connection?.accessToken) return null;

  return {
    accessToken: connection.accessToken,
  };
}

function getSpotifyHeaders(credentials: {
  accessToken: string;
}): HeadersInit {
  return {
    Authorization: `Bearer ${credentials.accessToken}`,
    "Content-Type": "application/json",
  };
}

function buildPlaylistUrl(playlistId: string): string {
  return `https://open.spotify.com/playlist/${playlistId}`;
}

function buildTrackUrl(trackId: string): string {
  return `https://open.spotify.com/track/${trackId}`;
}

function buildAlbumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}

function buildArtistUrl(artistId: string): string {
  return `https://open.spotify.com/artist/${artistId}`;
}

function processImageUrl(images: any[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  return images[0]?.url || null;
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
  const description = playlist.description || `${playlist.tracks.total} tracks`;
  return {
    kind: "spotify_playlist",
    title: playlist.name,
    url: buildPlaylistUrl(playlist.id),
    body: description,
    summary: description?.substring(0, 500) || null,
    occurredAt: normalizeDateToIso(playlist.tracks.items?.[0]?.added_at),
    externalId: playlist.id,
    connectionId,
    resourceId,
    metadata: {
      owner: playlist.owner?.display_name,
      totalTracks: playlist.tracks?.total,
      isPublic: playlist.public,
      imageUrl: processImageUrl(playlist.images),
    },
  };
}

function mapTrackToEntityInput(
  track: any,
  playedAt?: string,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  const artists = track.artists?.map((a: any) => a.name).join(", ") || "Unknown";
  const description = `${artists} - ${track.album?.name || ""}`;
  
  return {
    kind: "spotify_track",
    title: track.name,
    url: buildTrackUrl(track.id),
    body: description,
    summary: description,
    occurredAt: normalizeDateToIso(playedAt || track.album?.release_date),
    externalId: track.id,
    connectionId,
    resourceId,
    metadata: {
      artists,
      album: track.album?.name,
      duration: track.duration_ms,
      explicit: track.explicit,
      imageUrl: processImageUrl(track.album?.images),
    },
  };
}

function mapAlbumToEntityInput(
  album: any,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  const artists = album.artists?.map((a: any) => a.name).join(", ") || "Unknown";
  const description = `${artists} - ${album.total_tracks} tracks`;
  
  return {
    kind: "spotify_album",
    title: album.name,
    url: buildAlbumUrl(album.id),
    body: description,
    summary: description,
    occurredAt: normalizeDateToIso(album.release_date),
    externalId: album.id,
    connectionId,
    resourceId,
    metadata: {
      artists,
      totalTracks: album.total_tracks,
      releaseDate: album.release_date,
      albumType: album.album_type,
      imageUrl: processImageUrl(album.images),
    },
  };
}

function mapArtistToEntityInput(
  artist: any,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  const description = `${artist.followers?.total || 0} followers`;
  return {
    kind: "spotify_artist",
    title: artist.name,
    url: buildArtistUrl(artist.id),
    body: description,
    summary: description,
    occurredAt: new Date().toISOString(),
    externalId: artist.id,
    connectionId,
    resourceId,
    metadata: {
      genres: artist.genres,
      popularity: artist.popularity,
      followers: artist.followers?.total,
      imageUrl: processImageUrl(artist.images),
    },
  };
}

export async function fetchUserPlaylists(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Spotify credentials not configured");
      return [];
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/playlists?limit=${DEFAULT_LIMIT}`,
      { headers: getSpotifyHeaders(credentials) }
    );

    if (!res.ok) {
      console.error("Spotify API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.items.map((pl: any) =>
      mapPlaylistToEntityInput(pl, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify playlists:", error);
    return [];
  }
}

export async function fetchSpotifyRecentlyPlayed(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Spotify credentials not configured");
      return [];
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/player/recently-played?limit=${DEFAULT_LIMIT}`,
      { headers: getSpotifyHeaders(credentials) }
    );

    if (!res.ok) {
      console.error(
        "Spotify Recently Played API error:",
        res.status,
        await res.text()
      );
      return [];
    }

    const data = await res.json();
    return data.items.map((item: any) =>
      mapTrackToEntityInput(item.track, item.played_at, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify recently played:", error);
    return [];
  }
}

export async function fetchTopTracks(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Spotify credentials not configured");
      return [];
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/top/tracks?limit=${DEFAULT_LIMIT}&time_range=short_term`,
      { headers: getSpotifyHeaders(credentials) }
    );

    if (!res.ok) {
      console.error("Spotify Top Tracks API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.items.map((track: any) =>
      mapTrackToEntityInput(track, undefined, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify top tracks:", error);
    return [];
  }
}

export async function fetchTopArtists(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Spotify credentials not configured");
      return [];
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/top/artists?limit=${DEFAULT_LIMIT}&time_range=short_term`,
      { headers: getSpotifyHeaders(credentials) }
    );

    if (!res.ok) {
      console.error("Spotify Top Artists API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.items.map((artist: any) =>
      mapArtistToEntityInput(artist, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify top artists:", error);
    return [];
  }
}

export async function fetchSavedAlbums(
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  try {
    const credentials = await getCredentials();

    if (!credentials) {
      console.error("Spotify credentials not configured");
      return [];
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/albums?limit=${DEFAULT_LIMIT}`,
      { headers: getSpotifyHeaders(credentials) }
    );

    if (!res.ok) {
      console.error("Spotify Saved Albums API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return data.items.map((item: any) =>
      mapAlbumToEntityInput(item.album, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify saved albums:", error);
    return [];
  }
}

export async function fetchSpotifyFromConnectionResources(): Promise<
  EntityInput[]
> {
  const connection = await getConnectionByProvider("spotify");
  if (!connection) return [];

  const resources = await getSelectedResources(connection.id);
  if (resources.length === 0) return [];

  const allItems: EntityInput[] = [];

  for (const resource of resources) {
    const sourceType = resource.externalId;

    if (sourceType === "playlists") {
      const items = await fetchUserPlaylists(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "recently-played") {
      const items = await fetchSpotifyRecentlyPlayed(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "top-tracks") {
      const items = await fetchTopTracks(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "top-artists") {
      const items = await fetchTopArtists(connection.id, resource.id);
      allItems.push(...items);
    } else if (sourceType === "saved-albums") {
      const items = await fetchSavedAlbums(connection.id, resource.id);
      allItems.push(...items);
    }
  }

  return allItems;
}
