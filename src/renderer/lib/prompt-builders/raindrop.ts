import { parseMetadata, EntityRow, PromptItem } from "./types";

const RAINDROP_ICON = "/apps/raindrop-skeuomorphic.png";

function extractTags(entity: EntityRow): string[] {
  const meta = parseMetadata(entity.metadata);
  return Array.isArray(meta?.tags) ? meta.tags : [];
}

function collectUniqueTags(entities: EntityRow[]): Set<string> {
  const tags = new Set<string>();

  for (const entity of entities) {
    const entityTags = extractTags(entity);
    for (const tag of entityTags) {
      tags.add(tag);
    }
  }

  return tags;
}

export function buildRaindropPromptsFromEntities(entities: EntityRow[]): PromptItem[] {
  if (entities.length === 0) {
    return [];
  }

  const tags = collectUniqueTags(entities);

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

/**
 * @deprecated Use buildRaindropPromptsFromEntities instead
 */
export const buildRaindropPromptsFromItems = buildRaindropPromptsFromEntities;
