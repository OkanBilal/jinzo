import type { FeedItem } from "../../cron";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../../cron/connection-utils";

const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";
const MAX_PER_PAGE = 50;
const DEFAULT_LIMIT = 5;
const DEFAULT_SORT = "-created";
const DEFAULT_TITLE = "No title";

function buildRaindropUrl(collectionId: string, limit: number): string {
  const normalizedLimit = normalizeLimit(limit, 1, MAX_PER_PAGE);
  return `${RAINDROP_API_BASE}/raindrops/${collectionId}?perpage=${normalizedLimit}&sort=${DEFAULT_SORT}`;
}

function getRaindropHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function extractTags(tags: any): string[] {
  return Array.isArray(tags) ? tags : [];
}

function mapRaindropToFeedItem(
  raindrop: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  return {
    title: raindrop.title || DEFAULT_TITLE,
    url: raindrop.link,
    description: raindrop.excerpt || null,
    date: normalizeDateToIso(raindrop.created),
    source: "raindrop",
    imageUrl: raindrop.cover || null,
    metadata: {
      tags: extractTags(raindrop.tags),
      collectionId: raindrop.collection?.$id || null,
    },
    itemType: "bookmark",
    connectionId: connectionId || null,
    resourceId: resourceId || null,
  };
}

async function getCredentials(): Promise<string | null> {
  const connection = await getConnectionWithTokens("raindrop");
  return connection?.accessToken || null;
}

interface RaindropResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: any;
}

interface RaindropConnection {
  id: string;
  token: string;
}

async function getRaindropConnection(): Promise<RaindropConnection | null> {
  const connection = await getConnectionWithTokens("raindrop");
  if (!connection?.accessToken) return null;

  return {
    id: connection.id,
    token: connection.accessToken,
  };
}

async function getSelectedRaindropCollections(
  connectionId: string
): Promise<RaindropResource[]> {
  const resources = await getSelectedResources(connectionId, "raindrop_collection");
  
  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

export async function fetchRaindropItems(
  collectionId: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string
): Promise<FeedItem[]> {
  const raindropToken = token || (await getCredentials());

  if (!raindropToken) {
    console.warn("Raindrop token not configured. Cannot fetch items.");
    return [];
  }

  try {
    const res = await fetch(buildRaindropUrl(collectionId, limit), {
      method: "GET",
      headers: getRaindropHeaders(raindropToken),
    });

    if (!res.ok) {
      console.error("Raindrop API error:", res.status);
      return [];
    }

    const data = await res.json();

    if (!data.items || !Array.isArray(data.items)) {
      console.error("Invalid Raindrop API response: missing items array");
      return [];
    }

    return data.items
      .slice(0, limit)
      .map((item: any) =>
        mapRaindropToFeedItem(item, connectionId, resourceId)
      );
  } catch (error) {
    console.error("Error fetching Raindrop items:", error);
    return [];
  }
}

export async function fetchRaindropFromConnectionResources(
  itemsPerCollection = 10
): Promise<FeedItem[]> {
  const connection = await getRaindropConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Raindrop: No active connection found");
    return [];
  }

  const collections = await getSelectedRaindropCollections(connection.id);
  if (collections.length === 0) {
    console.warn("⚠️  No selected Raindrop collections found");
    return [];
  }

  const allItems: FeedItem[] = [];

  for (const resource of collections) {
    try {
      const items = await fetchRaindropItems(
        resource.externalId,
        itemsPerCollection,
        connection.id,
        resource.id,
        connection.token
      );

      allItems.push(...items);
    } catch (error) {
      throw error;
    }
  }
  return allItems;
}
