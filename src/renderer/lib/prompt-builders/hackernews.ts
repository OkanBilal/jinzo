import type { EntityRow, PromptItem } from "./types";

const HACKERNEWS_ICON = "/apps/hackernews-skeuomorphic.png";

export function buildHackerNewsPromptsFromEntities(
  entities: EntityRow[]
): PromptItem[] {
  if (entities.length === 0) {
    return [];
  }

  return [
    {
      label: "Top HN stories",
      imageSrc: HACKERNEWS_ICON,
    },
  ];
}

/**
 * @deprecated Use buildHackerNewsPromptsFromEntities instead
 */
export const buildHackerNewsPromptsFromItems = buildHackerNewsPromptsFromEntities;
