import type { FeedRow, PromptItem } from "./types";

const HACKERNEWS_ICON = "/apps/hackernews-skeuomorphic.png";

export function buildHackerNewsPromptsFromItems(
  items: FeedRow[]
): PromptItem[] {
  if (items.length === 0) {
    return [];
  }

  return [
    {
      label: "Top HN stories",
      imageSrc: HACKERNEWS_ICON,
    },
  ];
}
