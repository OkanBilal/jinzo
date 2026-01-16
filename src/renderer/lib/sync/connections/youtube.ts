import type { EntityInput } from "@/lib/sync";

interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

interface YouTubeThumbnails {
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
  standard?: YouTubeThumbnail;
  maxres?: YouTubeThumbnail;
}

interface YouTubePlaylistSnippet {
  title: string;
  description: string;
  publishedAt: string;
  thumbnails?: YouTubeThumbnails;
}

interface YouTubePlaylistItem {
  id: string;
  snippet: YouTubePlaylistSnippet;
}

interface YouTubeSubscriptionResourceId {
  channelId: string;
}

interface YouTubeSubscriptionSnippet {
  title: string;
  publishedAt: string;
  thumbnails?: YouTubeThumbnails;
  resourceId: YouTubeSubscriptionResourceId;
}

interface YouTubeSubscriptionItem {
  snippet: YouTubeSubscriptionSnippet;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const YOUTUBE_SITE_BASE = "https://www.youtube.com";
const DEFAULT_MAX_RESULTS = 5;

function buildYouTubeApiUrl(endpoint: string, maxResults = DEFAULT_MAX_RESULTS): string {
  return `${YOUTUBE_API_BASE}/${endpoint}?part=snippet&mine=true&maxResults=${maxResults}`;
}

function buildPlaylistUrl(playlistId: string): string {
  return `${YOUTUBE_SITE_BASE}/playlist?list=${playlistId}`;
}

function buildChannelUrl(channelId: string): string {
  return `${YOUTUBE_SITE_BASE}/channel/${channelId}`;
}

function extractThumbnailUrl(thumbnails?: YouTubeThumbnails): string | null {
  if (!thumbnails) return null;
  return thumbnails.medium?.url ?? thumbnails.high?.url ?? thumbnails.default?.url ?? null;
}

function mapPlaylistToEntityInput(
  playlist: YouTubePlaylistItem,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  return {
    kind: "youtube_playlist",
    title: playlist.snippet.title,
    url: buildPlaylistUrl(playlist.id),
    body: playlist.snippet.description,
    summary: playlist.snippet.description?.substring(0, 500) || null,
    occurredAt: playlist.snippet.publishedAt,
    externalId: playlist.id,
    connectionId: connectionId || null,
    resourceId: resourceId || null,
    metadata: {
      playlistId: playlist.id,
      imageUrl: extractThumbnailUrl(playlist.snippet.thumbnails),
    },
  };
}

function mapSubscriptionToEntityInput(
  subscription: YouTubeSubscriptionItem,
  connectionId?: string,
  resourceId?: string
): EntityInput {
  const channelId = subscription.snippet.resourceId.channelId;
  return {
    kind: "youtube_channel",
    title: subscription.snippet.title,
    url: buildChannelUrl(channelId),
    body: null,
    summary: null,
    occurredAt: subscription.snippet.publishedAt,
    externalId: channelId,
    connectionId: connectionId || null,
    resourceId: resourceId || null,
    metadata: {
      channelId,
      imageUrl: extractThumbnailUrl(subscription.snippet.thumbnails),
    },
  };
}


export async function fetchYoutubePlaylists(
  accessToken: string,
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  const res = await fetch(
    buildYouTubeApiUrl("playlists"),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error("YouTube API error: playlists");

  const data = await res.json();

  return data.items.map((pl: YouTubePlaylistItem) =>
    mapPlaylistToEntityInput(pl, connectionId, resourceId)
  );
}

export async function fetchYoutubeSubscriptions(
  accessToken: string,
  connectionId?: string,
  resourceId?: string
): Promise<EntityInput[]> {
  const res = await fetch(
    buildYouTubeApiUrl("subscriptions"),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error("YouTube API error: subscriptions");

  const data = await res.json();

  return data.items.map((sub: YouTubeSubscriptionItem) =>
    mapSubscriptionToEntityInput(sub, connectionId, resourceId)
  );
}
