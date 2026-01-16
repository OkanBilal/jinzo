

import { parseMetadata, EntityRow, PromptItem } from "./types";

const PODCAST_ICON = "/apps/podcast-skeuomorphic.png";

function extractPodcastName(entity: EntityRow): string | undefined {
  const meta = parseMetadata(entity.metadata);
  return meta?.podcastName;
}

function collectUniquePodcasts(entities: EntityRow[]): Set<string> {
  const podcasts = new Set<string>();
  
  for (const entity of entities) {
    const podcastName = extractPodcastName(entity);
    if (podcastName) {
      podcasts.add(podcastName);
    }
  }
  
  return podcasts;
}

export function buildPodcastPromptsFromEntities(entities: EntityRow[]): PromptItem[] {
  if (entities.length === 0) {
    return [];
  }

  const podcasts = collectUniquePodcasts(entities);
  
  return Array.from(podcasts).map((name): PromptItem => ({
    label: `${name} episodes`,
    imageSrc: PODCAST_ICON,
  }));
}

/**
 * @deprecated Use buildPodcastPromptsFromEntities instead
 */
export const buildPodcastPromptsFromItems = buildPodcastPromptsFromEntities;