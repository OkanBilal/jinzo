import { parseMetadata, FeedRow, PromptItem } from "./types";

const GITHUB_ICON = "/apps/github-skeuomorphic.png";

function extractRepoName(item: FeedRow): string | undefined {
  const meta = parseMetadata(item.metadata);
  return meta?.repo;
}

function collectUniqueRepos(items: FeedRow[]): Set<string> {
  const repos = new Set<string>();

  for (const item of items) {
    const repo = extractRepoName(item);
    if (repo) {
      repos.add(repo);
    }
  }

  return repos;
}

export function buildGitHubPromptsFromItems(items: FeedRow[]): PromptItem[] {
  if (items.length === 0) {
    return [];
  }

  const repos = collectUniqueRepos(items);

  return Array.from(repos).map(
    (repo): PromptItem => ({
      label: `${repo} issues`,
      imageSrc: GITHUB_ICON,
    })
  );
}
