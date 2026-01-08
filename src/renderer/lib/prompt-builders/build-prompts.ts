import {
  FeedRow,
  buildPodcastPromptsFromItems,
  buildGitHubPromptsFromItems,
  buildAppleMusicPromptsFromItems,
  buildRaindropPromptsFromItems,
  buildHackerNewsPromptsFromItems,
  PromptItem,
} from ".";

const FEED_API_ENDPOINT = "/api/feed";

const ITEM_TYPE_BUILDERS = {
  "podcast-episode": buildPodcastPromptsFromItems,
  issue: buildGitHubPromptsFromItems,
  "apple-music-playlist": buildAppleMusicPromptsFromItems,
  bookmark: buildRaindropPromptsFromItems,
  news: buildHackerNewsPromptsFromItems,
} as const;

function normalizeItemTypes(itemType: string | string[]): string[] {
  return Array.isArray(itemType) ? itemType : [itemType];
}

function buildFeedQueryParams(
  itemTypes: string[],
  limit: number
): URLSearchParams {
  const params = new URLSearchParams();
  itemTypes.forEach((type) => params.append("itemType", type));
  params.set("limit", String(limit));
  return params;
}

async function fetchFeedItems(
  itemTypes: string[],
  limit: number
): Promise<FeedRow[]> {
  try {
    const params = buildFeedQueryParams(itemTypes, limit);
    const url = `${FEED_API_ENDPOINT}?${params.toString()}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error("Feed API error:", res.status);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error("Error fetching feed items:", error);
    return [];
  }
}

function hasBuilder(
  itemType: string
): itemType is keyof typeof ITEM_TYPE_BUILDERS {
  return itemType in ITEM_TYPE_BUILDERS;
}

function buildPromptsForType(itemType: string, items: FeedRow[]): PromptItem[] {
  if (!hasBuilder(itemType)) {
    return [];
  }

  const builder = ITEM_TYPE_BUILDERS[itemType];
  return builder(items);
}

export async function buildPromptsByItemType(
  itemType: string | string[]
): Promise<PromptItem[]> {
  const itemTypes = normalizeItemTypes(itemType);

  const items = await fetchFeedItems(itemTypes, 5);

  const allPrompts: PromptItem[] = [];
  for (const type of itemTypes) {
    const typePrompts = buildPromptsForType(type, items);
    allPrompts.push(...typePrompts);
  }
  return allPrompts;
}

export async function buildPodcastPrompts(): Promise<PromptItem[]> {
  return buildPromptsByItemType("podcast-episode");
}

export async function buildGitHubPrompts(): Promise<PromptItem[]> {
  return buildPromptsByItemType("issue");
}

export async function buildAppleMusicPrompts(): Promise<PromptItem[]> {
  return buildPromptsByItemType("apple-music-playlist");
}

export async function buildRaindropPrompts(): Promise<PromptItem[]> {
  return buildPromptsByItemType("bookmark");
}

export async function buildHackerNewsPrompts(): Promise<PromptItem[]> {
  return buildPromptsByItemType("news");
}
