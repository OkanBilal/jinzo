import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeDateToIso,
} from "../sync.connection-utils";

const TADDY_API_URL = "https://api.taddy.org";
const DEFAULT_EPISODE_LIMIT = 5;

async function getCredentials(): Promise<{
  apiKey: string;
  userId: string;
} | null> {
  const connection = await getConnectionWithTokens("podcast");
  if (!connection?.accessToken || !connection?.refreshToken) return null;

  return {
    apiKey: connection.accessToken,
    userId: connection.refreshToken,
  };
}

function buildPodcastQuery(): string {
  return `
    query GetPodcastSeries($name: String!, $limit: Int!) {
      getPodcastSeries(name: $name) {
        uuid
        name
        imageUrl
        itunesId
        description
        episodes(sortOrder: LATEST, page: 1, limitPerPage: $limit) {
          uuid
          name
          description
          audioUrl
          imageUrl
          datePublished
        }
      }
    }
  `;
}

function mapEpisodeToEntityInput(
  episode: any,
  seriesData: any,
  connectionId?: string,
  resourceId?: string
): EntityInput | null {
  if (!episode.name || !episode.audioUrl) {
    return null;
  }

  const dateIso = normalizeDateToIso(episode.datePublished);

  return {
    kind: "podcast_episode",
    title: episode.name as string,
    url: episode.audioUrl as string,
    body: (episode.description as string) ?? null,
    summary: episode.description?.substring(0, 500) || null,
    occurredAt: dateIso,
    externalId: episode.uuid,
    connectionId: connectionId || null,
    resourceId: resourceId || null,
    metadata: {
      podcastName: seriesData.name,
      podcastUuid: seriesData.uuid,
      episodeUuid: episode.uuid,
      imageUrl: (episode.imageUrl || seriesData.imageUrl) ?? null,
    },
  };
}

export async function fetchPodcastByName(
  podcastName: string,
  limitEpisodes = DEFAULT_EPISODE_LIMIT,
  connectionId?: string,
  resourceId?: string,
  credentials?: { apiKey: string; userId: string }
): Promise<EntityInput[]> {
  const taddyCredentials = credentials || (await getCredentials());
  if (!taddyCredentials) {
    console.warn(
      "Taddy API credentials not configured. Cannot fetch podcasts."
    );
    return [];
  }

  const { apiKey, userId } = taddyCredentials;
  const query = buildPodcastQuery();
  const variables = {
    name: podcastName,
    limit: limitEpisodes,
  };

  try {
    const res = await fetch(TADDY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        "X-USER-ID": userId,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.error(`Taddy API error: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const series = json.data?.getPodcastSeries;

    if (!series) {
      console.warn(`Podcast not found: ${podcastName}`);
      return [];
    }

    const episodes = series.episodes?.slice(0, limitEpisodes) ?? [];

    return episodes
      .map((ep: any) =>
        mapEpisodeToEntityInput(ep, series, connectionId, resourceId)
      )
      .filter((item: EntityInput | null): item is EntityInput => item !== null);
  } catch (error) {
    console.error(`Failed to fetch podcast "${podcastName}":`, error);
    return [];
  }
}

interface PodcastConnection {
  id: string;
  apiKey: string;
  userId: string;
}

async function getConnection(): Promise<PodcastConnection | null> {
  const connection = await getConnectionWithTokens("podcast");
  if (!connection?.accessToken || !connection?.refreshToken) return null;

  return {
    id: connection.id,
    apiKey: connection.accessToken,
    userId: connection.refreshToken,
  };
}

interface PodcastResource {
  id: string;
  connectionId: string;
  name: string;
  metadata: any;
}

async function getSelectedPodcasts(
  connectionId: string
): Promise<PodcastResource[]> {
  const resources = await getSelectedResources(connectionId, "taddy_podcast");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    name: r.name,
    metadata: r.metadata,
  }));
}

export async function fetchPodcastsFromConnectionResources(
  episodesPerPodcast = 5
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Podcasts: No active connection found");
    return [];
  }

  const podcasts = await getSelectedPodcasts(connection.id);
  if (podcasts.length === 0) {
    console.warn("⚠️  No selected podcasts found");
    return [];
  }

  const allItems: EntityInput[] = [];
  const credentials = { apiKey: connection.apiKey, userId: connection.userId };

  for (const resource of podcasts) {
    const items = await fetchPodcastByName(
      resource.name,
      episodesPerPodcast,
      connection.id,
      resource.id,
      credentials
    );

    allItems.push(...items);
  }

  return allItems;
}
