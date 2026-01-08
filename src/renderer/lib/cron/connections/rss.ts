import { and, eq } from "drizzle-orm";
import Parser from "rss-parser";

import { getDb } from "../../../../main/db/client";
import { connectionResources, connections } from "../../../../main/db/schema";
import { FeedItem, extractImageFromHtml, pickUrl } from "../../cron";

const DEFAULT_TITLE = "No title";
const FALLBACK_URL = "#";

const parser = new Parser({
  customFields: {
    item: [
      "enclosure",
      "content",
      "summary",
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
      ["media:content", "mediaContent", { keepArray: true }],
      ["content:encoded", "contentEncoded"],
      ["media:group", "mediaGroup", { keepArray: false }],
    ],
  },
});

function extractMediaThumbnail(item: any): any {
  return (
    item["media:thumbnail"] ??
    item.mediaThumbnail ??
    item.media_thumbnail ??
    item.mediaGroup?.thumbnail
  );
}

function extractMediaContent(item: any): any {
  return (
    item["media:content"] ?? item.mediaContent ?? item.media_group?.content
  );
}

function findImageUrl(item: any): string | null {
  const mediaThumb = extractMediaThumbnail(item);
  const mediaContent = extractMediaContent(item);

  return (
    pickUrl(mediaThumb) ||
    pickUrl(mediaContent) ||
    pickUrl(item.enclosure) ||
    extractImageFromHtml(item.contentEncoded) ||
    extractImageFromHtml(item.content) ||
    extractImageFromHtml(item.summary) ||
    extractImageFromHtml(item.description) ||
    null
  );
}

function extractDescription(item: any): string | null {
  return item.summary ?? item.contentSnippet ?? item.description ?? null;
}

function extractDate(item: any): string {
  return item.isoDate || item.pubDate || new Date().toISOString();
}

export async function fetchRssFeed(
  url: string,
  sourceName: string
): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items ?? [];

    return items.map((item): FeedItem => {
      const imageUrl = findImageUrl(item);
      const description = extractDescription(item);
      const date = extractDate(item);

      return {
        title: item.title ?? DEFAULT_TITLE,
        url: item.link ?? FALLBACK_URL,
        description,
        date,
        source: sourceName,
        imageUrl,
        metadata: null,
        itemType: "article",
      };
    });
  } catch (error) {
    console.error(`Failed to fetch RSS feed from ${url}:`, error);
    return [];
  }
}

export async function fetchRssFromConnectionResources(
  limit: number = 10
): Promise<FeedItem[]> {
  try {
    const db = getDb();
    
    const connection = await db
      .select()
      .from(connections)
      .where(eq(connections.provider, "rss"))
      .get();

    if (!connection) {
      console.log("No RSS connection found");
      return [];
    }

    const resources = await db
      .select()
      .from(connectionResources)
      .where(
        and(
          eq(connectionResources.connectionId, connection.id),
          eq(connectionResources.kind, "rss_feed"),
          eq(connectionResources.selected, true)
        )
      )
      .all();

    if (resources.length === 0) {
      console.log("No RSS feeds selected");
      return [];
    }

    const allItems: FeedItem[] = [];

    for (const resource of resources) {
      const feedUrl = resource.url || resource.externalId;
      const feedName = resource.name || "RSS Feed";

      try {
        const items = await fetchRssFeed(feedUrl, feedName);
        allItems.push(...items.slice(0, limit));
      } catch (error) {
        console.error(`Failed to fetch RSS feed ${feedName}:`, error);
      }
    }

    return allItems;
  } catch (error) {
    console.error("Error fetching RSS feeds from connection resources:", error);
    return [];
  }
}
