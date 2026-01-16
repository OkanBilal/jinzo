import {
  EntityRow,
  buildPodcastPromptsFromEntities,
  buildGitHubPromptsFromEntities,
  buildAppleMusicPromptsFromEntities,
  buildRaindropPromptsFromEntities,
  buildHackerNewsPromptsFromEntities,
  PromptItem,
} from ".";

const KIND_BUILDERS = {
  podcast_episode: buildPodcastPromptsFromEntities,
  issue: buildGitHubPromptsFromEntities,
  pull_request: buildGitHubPromptsFromEntities,
  apple_music_playlist: buildAppleMusicPromptsFromEntities,
  apple_music_track: buildAppleMusicPromptsFromEntities,
  bookmark: buildRaindropPromptsFromEntities,
  hn_story: buildHackerNewsPromptsFromEntities,
  hn_comment: buildHackerNewsPromptsFromEntities,
} as const;

function normalizeKinds(kind: string | string[]): string[] {
  return Array.isArray(kind) ? kind : [kind];
}

async function fetchEntities(
  kinds: string[],
  limit: number
): Promise<EntityRow[]> {
  try {
    // Fetch entities for each kind and combine results
    const allEntities: EntityRow[] = [];
    
    for (const kind of kinds) {
      const response = await window.api.entities.getAll({ kind, limit });
      
      if (response.success && response.data) {
        allEntities.push(...response.data);
      }
    }
    
    return allEntities;
  } catch (error) {
    console.error("Error fetching entities:", error);
    return [];
  }
}

function hasBuilder(
  kind: string
): kind is keyof typeof KIND_BUILDERS {
  return kind in KIND_BUILDERS;
}

function buildPromptsForKind(kind: string, entities: EntityRow[]): PromptItem[] {
  if (!hasBuilder(kind)) {
    return [];
  }

  const builder = KIND_BUILDERS[kind];
  return builder(entities);
}

export async function buildPromptsByKind(
  kind: string | string[]
): Promise<PromptItem[]> {
  const kinds = normalizeKinds(kind);

  const entities = await fetchEntities(kinds, 5);

  const allPrompts: PromptItem[] = [];
  for (const k of kinds) {
    const kindPrompts = buildPromptsForKind(k, entities);
    allPrompts.push(...kindPrompts);
  }
  return allPrompts;
}

/**
 * @deprecated Use buildPromptsByKind instead
 */
export const buildPromptsByItemType = buildPromptsByKind;

export async function buildPodcastPrompts(): Promise<PromptItem[]> {
  return buildPromptsByKind("podcast_episode");
}

export async function buildGitHubPrompts(): Promise<PromptItem[]> {
  return buildPromptsByKind(["issue", "pull_request"]);
}

export async function buildAppleMusicPrompts(): Promise<PromptItem[]> {
  return buildPromptsByKind(["apple_music_playlist", "apple_music_track"]);
}

export async function buildRaindropPrompts(): Promise<PromptItem[]> {
  return buildPromptsByKind("bookmark");
}

export async function buildHackerNewsPrompts(): Promise<PromptItem[]> {
  return buildPromptsByKind(["hn_story", "hn_comment"]);
}
