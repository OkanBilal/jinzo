import { useEffect, useState } from "react";

import {
  buildGitHubPrompts,
  buildRaindropPrompts,
  buildHackerNewsPrompts,
  buildAppleMusicPrompts,
  buildPodcastPrompts,
} from "../../../lib/prompt-builders";
import { PromptItem } from "../../../lib/prompt-builders";

type PromptBuilder = () => Promise<PromptItem[]>;

const APP_PROMPT_BUILDERS: Record<string, PromptBuilder> = {
  github: buildGitHubPrompts,
  raindrop: buildRaindropPrompts,
  hackernews: buildHackerNewsPrompts,
  "apple-music": buildAppleMusicPrompts,
  podcast: buildPodcastPrompts,
};

const ALL_PROMPT_BUILDERS: PromptBuilder[] = [
  buildGitHubPrompts,
  buildRaindropPrompts,
  buildHackerNewsPrompts,
  buildAppleMusicPrompts,
  buildPodcastPrompts,
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function fetchAllPrompts(
  builders: PromptBuilder[]
): Promise<PromptItem[]> {
  try {
    const results = await Promise.all(builders.map((builder) => builder()));
    return results.flat();
  } catch (error) {
    console.error("Failed to load dynamic prompts:", error);
    return [];
  }
}

async function fetchPromptsForApp(appId: string): Promise<PromptItem[]> {
  const builder = APP_PROMPT_BUILDERS[appId];
  if (!builder) {
    console.warn(`No prompt builder found for app: ${appId}`);
    return [];
  }

  try {
    return await builder();
  } catch (error) {
    console.error(`Failed to load prompts for ${appId}:`, error);
    return [];
  }
}

export function useCreatePrompts(appId?: string | null): PromptItem[] {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPrompts() {
      let fetchedPrompts: PromptItem[];

      if (appId) {
        fetchedPrompts = await fetchPromptsForApp(appId);
      } else {
        fetchedPrompts = await fetchAllPrompts(ALL_PROMPT_BUILDERS);
      }

      if (!isCancelled) {
        const shuffledPrompts = shuffleArray(fetchedPrompts);
        setPrompts(shuffledPrompts);
      }
    }

    loadPrompts();

    return () => {
      isCancelled = true;
    };
  }, [appId]);

  return prompts;
}
