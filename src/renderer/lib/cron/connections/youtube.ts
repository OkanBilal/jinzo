import type { FeedItem } from "@/lib/cron";

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

function mapPlaylistToFeedItem(playlist: YouTubePlaylistItem): FeedItem {
  return {
    title: playlist.snippet.title,
    url: buildPlaylistUrl(playlist.id),
    description: playlist.snippet.description,
    date: playlist.snippet.publishedAt,
    source: "youtube",
    imageUrl: extractThumbnailUrl(playlist.snippet.thumbnails),
    metadata: { playlistId: playlist.id },
    itemType: "youtube-playlist",
  };
}

function mapSubscriptionToFeedItem(subscription: YouTubeSubscriptionItem): FeedItem {
  const channelId = subscription.snippet.resourceId.channelId;
  return {
    title: subscription.snippet.title,
    url: buildChannelUrl(channelId),
    description: null,
    date: subscription.snippet.publishedAt,
    source: "youtube",
    imageUrl: extractThumbnailUrl(subscription.snippet.thumbnails),
    metadata: { channelId },
    itemType: "channel",
  };
}


export async function fetchYoutubePlaylists(accessToken: string): Promise<FeedItem[]> {
  const res = await fetch(
    buildYouTubeApiUrl("playlists"),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error("YouTube API error: playlists");

  const data = await res.json();

  return data.items.map((pl: YouTubePlaylistItem) => mapPlaylistToFeedItem(pl));
}

export async function fetchYoutubeSubscriptions(accessToken: string): Promise<FeedItem[]> {
  const res = await fetch(
    buildYouTubeApiUrl("subscriptions"),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error("YouTube API error: subscriptions");

  const data = await res.json();

  return data.items.map((sub: YouTubeSubscriptionItem) => mapSubscriptionToFeedItem(sub));
}
