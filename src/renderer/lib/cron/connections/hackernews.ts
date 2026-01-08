import type { FeedItem } from "../../cron";
import {
  getConnectionByProvider,
  getSelectedResources as getSelectedResourcesUtil,
  normalizeDateToIso,
} from "../../cron/connection-utils";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const HN_SITE_BASE = "https://news.ycombinator.com";
const DEFAULT_LIMIT = 10;
const DEFAULT_TITLE = "Untitled";

async function fetchItemById(id: number): Promise<any | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function buildHackerNewsUrl(storyId: number): string {
  return `${HN_SITE_BASE}/item?id=${storyId}`;
}

function normalizeStoryDate(timestamp?: number): string {
  return normalizeDateToIso(timestamp);
}

function mapStoryToFeedItem(
  story: any,
  connectionId?: string,
  resourceId?: string
): FeedItem {
  const hnUrl = buildHackerNewsUrl(story.id);
  const canonical = typeof story.url === "string" ? story.url : hnUrl;
  const dateIso = normalizeStoryDate(story.time);

  return {
    title: story.title ?? DEFAULT_TITLE,
    url: hnUrl,
    description: typeof story.text === "string" ? story.text : null,
    date: dateIso,
    source: "hackernews",
    imageUrl: null,
    metadata: {
      source_url: canonical,
      by: story.by,
      score: story.score,
      descendants: story.descendants,
    },
    itemType: "news",
    connectionId: connectionId || null,
    resourceId: resourceId || null,
  };
}

async function mapCommentToFeedItem(
  comment: any,
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem | null> {
  const hnUrl = buildHackerNewsUrl(comment.id);
  const dateIso = normalizeStoryDate(comment.time);

  let parentTitle = "Unknown Story";
  if (comment.parent) {
    const parent = await fetchItemById(comment.parent);
    if (parent) {
      if (parent.type === "story") {
        parentTitle = parent.title || "Unknown Story";
      } else if (parent.parent) {
        let rootParent = parent;
        let attempts = 0;
        while (rootParent.parent && attempts < 10) {
          const nextParent = await fetchItemById(rootParent.parent);
          if (!nextParent) break;
          if (nextParent.type === "story") {
            parentTitle = nextParent.title || "Unknown Story";
            break;
          }
          rootParent = nextParent;
          attempts++;
        }
      }
    }
  }

  return {
    title: `Comment on: ${parentTitle}`,
    url: hnUrl,
    description: comment.text || null,
    date: dateIso,
    source: "hackernews",
    imageUrl: null,
    metadata: {
      by: comment.by,
      parent: comment.parent,
      commentId: comment.id,
    },
    itemType: "user-comment",
    connectionId: connectionId || null,
    resourceId: resourceId || null,
  };
}

export async function fetchHackerNews(
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
  try {
    const response = await fetch(`${HN_API_BASE}/topstories.json`);
    if (!response.ok) return [];

    const ids: number[] = await response.json();
    if (!Array.isArray(ids)) return [];

    const items = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const story = await fetchItemById(id);
        if (!story) return null;
        return mapStoryToFeedItem(story, connectionId, resourceId);
      })
    );

    return items.filter((item): item is FeedItem => item !== null);
  } catch (error) {
    console.error("Failed to fetch Hacker News stories:", error);
    return [];
  }
}

export async function fetchUserSubmissions(
  username: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
  try {
    const userResponse = await fetch(`${HN_API_BASE}/user/${username}.json`);
    if (!userResponse.ok) {
      console.warn(`User ${username} not found or API error`);
      return [];
    }

    const user = await userResponse.json();

    if (!user || !user.submitted) {
      console.warn(`User ${username} has no submissions or user not found`);
      return [];
    }

    const ids: number[] = user.submitted ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const items = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const item = await fetchItemById(id);
        if (!item) return null;

        if (item.type === "story") {
          return mapStoryToFeedItem(item, connectionId, resourceId);
        }

        return null;
      })
    );

    return items.filter((item): item is FeedItem => item !== null);
  } catch (error) {
    console.error(`Failed to fetch submissions for user ${username}:`, error);
    return [];
  }
}

export async function fetchUserComments(
  username: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string
): Promise<FeedItem[]> {
  try {
    const userResponse = await fetch(`${HN_API_BASE}/user/${username}.json`);
    if (!userResponse.ok) {
      console.warn(`User ${username} not found or API error`);
      return [];
    }

    const user = await userResponse.json();

    if (!user || !user.submitted) {
      console.warn(`User ${username} has no submissions or user not found`);
      return [];
    }

    const ids: number[] = user.submitted ?? [];

    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const comments: FeedItem[] = [];

    for (const id of ids) {
      if (comments.length >= limit) break;

      const item = await fetchItemById(id);
      if (!item) continue;

      if (item.type === "comment") {
        const commentItem = await mapCommentToFeedItem(
          item,
          connectionId,
          resourceId
        );
        if (commentItem) {
          comments.push(commentItem);
        }
      }
    }

    return comments;
  } catch (error) {
    console.error(`Failed to fetch comments for user ${username}:`, error);
    return [];
  }
}

interface HackerNewsConnection {
  id: string;
  username: string | null;
}

async function getConnection(): Promise<HackerNewsConnection | null> {
  const connection = await getConnectionByProvider("hackernews");
  if (!connection) return null;

  return {
    id: connection.id,
    username: connection.metadata?.username || null,
  };
}

interface HackerNewsResource {
  id: string;
  kind: string;
  selected: boolean;
}

async function getSelectedResources(
  connectionId: string
): Promise<HackerNewsResource[]> {
  const resources = await getSelectedResourcesUtil(connectionId);

  return resources.map((r) => ({
    id: r.id,
    kind: r.kind,
    selected: true,
  }));
}

export async function fetchHackerNewsFromConnectionResources(
  topStoriesLimit = 10,
  userSubmissionsLimit = 10,
  userCommentsLimit = 10
): Promise<FeedItem[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping HackerNews: No active connection found");
    return [];
  }

  const resources = await getSelectedResources(connection.id);
  if (resources.length === 0) {
    console.warn("⚠️  No selected HackerNews resources found");
    return [];
  }

  const allItems: FeedItem[] = [];

  for (const resource of resources) {
    try {
      if (resource.kind === "hn_top_stories") {
        const items = await fetchHackerNews(
          topStoriesLimit,
          connection.id,
          resource.id
        );
        allItems.push(...items);
      } else if (
        resource.kind === "hn_user_submissions" &&
        connection.username
      ) {
        const items = await fetchUserSubmissions(
          connection.username,
          userSubmissionsLimit,
          connection.id,
          resource.id
        );
        allItems.push(...items);
      } else if (resource.kind === "hn_user_comments" && connection.username) {
        const items = await fetchUserComments(
          connection.username,
          userCommentsLimit,
          connection.id,
          resource.id
        );
        allItems.push(...items);
      }
    } catch (error) {
      throw error;
    }
  }

  return allItems;
}
