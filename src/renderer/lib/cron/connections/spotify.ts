import type { FeedItem } from "../../cron";
import {
  getConnectionWithTokens,
  getConnectionByProvider,
  getSelectedResources,
} from "../../cron/connection-utils";

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
  // Spotify returns images sorted by size, get the first one (largest)
  return images[0]?.url || null;
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
    title: playlist.name,
    url: buildPlaylistUrl(playlist.id),
    description: playlist.description || `${playlist.tracks.total} tracks`,
    date: normalizeDateToIso(playlist.tracks.items?.[0]?.added_at),
    source: "spotify",
    imageUrl: processImageUrl(playlist.images),
    metadata: {
      owner: playlist.owner?.display_name,
      totalTracks: playlist.tracks?.total,
      isPublic: playlist.public,
    },
    itemType: "spotify-playlist",
    connectionId,
    resourceId,
  };
}

function mapTrackToFeedItem(
  track: any,
  playedAt?: string,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  const artists = track.artists?.map((a: any) => a.name).join(", ") || "Unknown";
  
  return {
    title: track.name,
    url: buildTrackUrl(track.id),
    description: `${artists} - ${track.album?.name || ""}`,
    date: normalizeDateToIso(playedAt || track.album?.release_date),
    source: "spotify",
    imageUrl: processImageUrl(track.album?.images),
    metadata: {
      artists,
      album: track.album?.name,
      duration: track.duration_ms,
      explicit: track.explicit,
    },
    itemType: "spotify-track",
    connectionId,
    resourceId,
  };
}

function mapAlbumToFeedItem(
  album: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  const artists = album.artists?.map((a: any) => a.name).join(", ") || "Unknown";
  
  return {
    title: album.name,
    url: buildAlbumUrl(album.id),
    description: `${artists} - ${album.total_tracks} tracks`,
    date: normalizeDateToIso(album.release_date),
    source: "spotify",
    imageUrl: processImageUrl(album.images),
    metadata: {
      artists,
      totalTracks: album.total_tracks,
      releaseDate: album.release_date,
      albumType: album.album_type,
    },
    itemType: "spotify-album",
    connectionId,
    resourceId,
  };
}

function mapArtistToFeedItem(
  artist: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  return {
    title: artist.name,
    url: buildArtistUrl(artist.id),
    description: `${artist.followers?.total || 0} followers`,
    date: new Date().toISOString(),
    source: "spotify",
    imageUrl: processImageUrl(artist.images),
    metadata: {
      genres: artist.genres,
      popularity: artist.popularity,
      followers: artist.followers?.total,
    },
    itemType: "spotify-artist",
    connectionId,
    resourceId,
  };
}

export async function fetchUserPlaylists(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapPlaylistToFeedItem(pl, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify playlists:", error);
    return [];
  }
}

export async function fetchSpotifyRecentlyPlayed(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapTrackToFeedItem(item.track, item.played_at, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify recently played:", error);
    return [];
  }
}

export async function fetchTopTracks(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapTrackToFeedItem(track, undefined, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify top tracks:", error);
    return [];
  }
}

export async function fetchTopArtists(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapArtistToFeedItem(artist, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify top artists:", error);
    return [];
  }
}

export async function fetchSavedAlbums(
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
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
      mapAlbumToFeedItem(item.album, connectionId, resourceId)
    );
  } catch (error) {
    console.error("Error fetching Spotify saved albums:", error);
    return [];
  }
}

export async function fetchSpotifyFromConnectionResources(): Promise<
  FeedItem[]
> {
  const connection = await getConnectionByProvider("spotify");
  if (!connection) return [];

  const resources = await getSelectedResources(connection.id);
  if (resources.length === 0) return [];

  const allItems: FeedItem[] = [];

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
