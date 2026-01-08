

import { parseMetadata, FeedRow, PromptItem } from "./types";

const PODCAST_ICON = "/apps/podcast-skeuomorphic.png";

function extractPodcastName(item: FeedRow): string | undefined {
  const meta = parseMetadata(item.metadata);
  return meta?.podcastName;
}

function collectUniquePodcasts(items: FeedRow[]): Set<string> {
  const podcasts = new Set<string>();
  
  for (const item of items) {
    const podcastName = extractPodcastName(item);
    if (podcastName) {
      podcasts.add(podcastName);
    }
  }
  
  return podcasts;
}

export function buildPodcastPromptsFromItems(items: FeedRow[]): PromptItem[] {
  if (items.length === 0) {
    return [];
  }

  const podcasts = collectUniquePodcasts(items);
  
  return Array.from(podcasts).map((name): PromptItem => ({
    label: `${name} episodes`,
    imageSrc: PODCAST_ICON,
  }));
}