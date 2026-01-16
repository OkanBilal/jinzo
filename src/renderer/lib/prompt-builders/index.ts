
export * from "./types";

export { buildPodcastPromptsFromEntities, buildPodcastPromptsFromItems } from "./podcast";
export { buildGitHubPromptsFromEntities, buildGitHubPromptsFromItems } from "./github";
export { buildAppleMusicPromptsFromEntities, buildAppleMusicPromptsFromItems } from "./apple-music";
export { buildRaindropPromptsFromEntities, buildRaindropPromptsFromItems } from "./raindrop";
export { buildHackerNewsPromptsFromEntities, buildHackerNewsPromptsFromItems } from "./hackernews";

export {
  buildPromptsByKind,
  buildPromptsByItemType, // deprecated
  buildPodcastPrompts,
  buildGitHubPrompts,
  buildAppleMusicPrompts,
  buildRaindropPrompts,
  buildHackerNewsPrompts,
} from "./build-prompts";