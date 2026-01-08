import { parseMetadata, FeedRow, PromptItem } from "./types";

const RAINDROP_ICON = "/apps/raindrop-skeuomorphic.png";

function extractTags(item: FeedRow): string[] {
  const meta = parseMetadata(item.metadata);
  return Array.isArray(meta?.tags) ? meta.tags : [];
}

function collectUniqueTags(items: FeedRow[]): Set<string> {
  const tags = new Set<string>();

  for (const item of items) {
    const itemTags = extractTags(item);
    for (const tag of itemTags) {
      tags.add(tag);
    }
  }

  return tags;
}

export function buildRaindropPromptsFromItems(items: FeedRow[]): PromptItem[] {
  if (items.length === 0) {
    return [];
  }

  const tags = collectUniqueTags(items);

  const generalPrompt: PromptItem = {
    label: "My bookmarks",
    imageSrc: RAINDROP_ICON,
  };

  const tagPrompts = Array.from(tags).map(
    (tag): PromptItem => ({
      label: `${tag} bookmarks`,
      imageSrc: RAINDROP_ICON,
    })
  );

  return [generalPrompt, ...tagPrompts];
}
