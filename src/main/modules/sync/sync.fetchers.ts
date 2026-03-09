import {
  fetchGitHubFromConnectionResources,
  fetchLinearFromConnectionResources,
  fetchJiraFromConnectionResources,
  fetchAsanaFromConnectionResources,
  fetchGitlabFromConnectionResources,
  fetchTrelloFromConnectionResources,
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
  TRELLO_CARDS: 50,
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
  trello: () => fetchTrelloFromConnectionResources(FETCH_LIMITS.TRELLO_CARDS),
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
