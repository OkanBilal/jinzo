import type { FeedRow, PromptItem } from "./types";

const APPLE_MUSIC_ICON = "/apps/apple-music-skeuomorphic.png";

export function buildAppleMusicPromptsFromItems(
  items: FeedRow[]
): PromptItem[] {
  if (items.length === 0) {
    return [];
  }

  return items.map(
    (item): PromptItem => ({
      label: item.title,
      imageSrc: APPLE_MUSIC_ICON,
    })
  );
}
