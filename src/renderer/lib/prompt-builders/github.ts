import { parseMetadata, EntityRow, PromptItem } from "./types";

const GITHUB_ICON = "/apps/github-skeuomorphic.png";

function extractRepoName(entity: EntityRow): string | undefined {
  const meta = parseMetadata(entity.metadata);
  return meta?.repo;
}

function collectUniqueRepos(entities: EntityRow[]): Set<string> {
  const repos = new Set<string>();

  for (const entity of entities) {
    const repo = extractRepoName(entity);
    if (repo) {
      repos.add(repo);
    }
  }

  return repos;
}

export function buildGitHubPromptsFromEntities(entities: EntityRow[]): PromptItem[] {
  if (entities.length === 0) {
    return [];
  }

  const repos = collectUniqueRepos(entities);

  return Array.from(repos).map(
    (repo): PromptItem => ({
      label: `${repo} issues`,
      imageSrc: GITHUB_ICON,
    })
  );
}

/**
 * @deprecated Use buildGitHubPromptsFromEntities instead
 */
export const buildGitHubPromptsFromItems = buildGitHubPromptsFromEntities;
