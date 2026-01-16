import type { EntityRow, PromptItem } from "./types";

const APPLE_MUSIC_ICON = "/apps/apple-music-skeuomorphic.png";

export function buildAppleMusicPromptsFromEntities(
  entities: EntityRow[]
): PromptItem[] {
  if (entities.length === 0) {
    return [];
  }

  return entities.map(
    (entity): PromptItem => ({
      label: entity.title,
      imageSrc: APPLE_MUSIC_ICON,
    })
  );
}

/**
 * @deprecated Use buildAppleMusicPromptsFromEntities instead
 */
export const buildAppleMusicPromptsFromItems = buildAppleMusicPromptsFromEntities;
