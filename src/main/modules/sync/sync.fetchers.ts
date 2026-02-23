import {
  fetchPodcastsFromConnectionResources,
  fetchRaindropFromConnectionResources,
  fetchRssFromConnectionResources,
  fetchAppleMusicFromConnectionResources,
  fetchSpotifyFromConnectionResources,
  fetchGitHubFromConnectionResources,
  fetchLinearFromConnectionResources,
  fetchJiraFromConnectionResources,
  fetchAsanaFromConnectionResources,
  fetchHackerNewsFromConnectionResources,
  fetchGitlabFromConnectionResources,
} from "./connections";
import type { EntityInput } from "./sync.dto";

export const FETCH_LIMITS = {
  GITHUB_ISSUES: 50,
  GITHUB_PRS: 50,
  GITLAB_ISSUES: 50,
  GITLAB_MRS: 50,
  LINEAR_ISSUES: 50,
  JIRA_ISSUES: 50,
  ASANA_TASKS: 50,
  RAINDROP: 20,
  HACKERNEWS_TOP: 20,
  HACKERNEWS_NEW: 20,
  HACKERNEWS_USER: 10,
  PODCASTS: 10,
  RSS: 10,
} as const;

const PROVIDER_FETCHERS: Record<string, () => Promise<EntityInput[]>> = {
  github: () =>
    fetchGitHubFromConnectionResources(
      FETCH_LIMITS.GITHUB_ISSUES,
      FETCH_LIMITS.GITHUB_PRS,
    ),
  gitlab: () =>
    fetchGitlabFromConnectionResources(
      FETCH_LIMITS.GITLAB_ISSUES,
      FETCH_LIMITS.GITLAB_MRS,
    ),
  linear: () => fetchLinearFromConnectionResources(FETCH_LIMITS.LINEAR_ISSUES),
  jira: () => fetchJiraFromConnectionResources(FETCH_LIMITS.JIRA_ISSUES),
  asana: () => fetchAsanaFromConnectionResources(FETCH_LIMITS.ASANA_TASKS),
  raindrop: () => fetchRaindropFromConnectionResources(FETCH_LIMITS.RAINDROP),
  hackernews: () =>
    fetchHackerNewsFromConnectionResources(
      FETCH_LIMITS.HACKERNEWS_TOP,
      FETCH_LIMITS.HACKERNEWS_NEW,
      FETCH_LIMITS.HACKERNEWS_USER,
    ),
  podcast: () => fetchPodcastsFromConnectionResources(FETCH_LIMITS.PODCASTS),
  "apple-music": () => fetchAppleMusicFromConnectionResources(),
  spotify: () => fetchSpotifyFromConnectionResources(),
  rss: () => fetchRssFromConnectionResources(FETCH_LIMITS.RSS),
};

export async function fetchAllEntities(provider?: string): Promise<EntityInput[]> {
  try {
    const fetchers =
      provider && PROVIDER_FETCHERS[provider]
        ? [PROVIDER_FETCHERS[provider]]
        : Object.values(PROVIDER_FETCHERS);

    const results = await Promise.all(fetchers.map((fn) => fn()));
    const entities = results.flat();

    console.log(`📥 Fetched ${entities.length} entities from sources${provider ? ` (provider: ${provider})` : ""}`);
    return entities;
  } catch (error) {
    console.error("Error fetching entities:", error);
    throw error;
  }
}
