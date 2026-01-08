import { Octokit } from "@octokit/rest";

import type { FeedItem } from "../../cron";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../../cron/connection-utils";

const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 5;

async function getCredentials(): Promise<string | null> {
  const connection = await getConnectionWithTokens("github");
  return connection?.accessToken || null;
}

async function getOctokit(token?: string): Promise<Octokit | null> {
  if (token) {
    return new Octokit({ auth: token });
  }

  const ghToken = await getCredentials();
  if (ghToken) {
    return new Octokit({ auth: ghToken });
  }
  return null;
}

function extractLabels(labels: any[]): string[] {
  if (!Array.isArray(labels)) return [];

  return labels
    .map((l: any) => (typeof l === "string" ? l : l?.name))
    .filter((s: any): s is string => typeof s === "string");
}

function formatRepoIdentifier(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

function parseRepoIdentifier(identifier: string): {
  owner: string;
  repo: string;
} | null {
  const parts = identifier.split("/");
  if (parts.length !== 2) {
    console.error(`Invalid repo identifier: ${identifier}`);
    return null;
  }
  return { owner: parts[0], repo: parts[1] };
}

interface GitHubResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: any;
}

interface GitHubConnection {
  id: string;
  token: string;
}

async function getConnection(): Promise<GitHubConnection | null> {
  const connection = await getConnectionWithTokens("github");
  if (!connection?.accessToken) return null;

  return {
    id: connection.id,
    token: connection.accessToken,
  };
}

async function getSelectedRepos(
  connectionId: string
): Promise<GitHubResource[]> {
  const resources = await getSelectedResources(connectionId, "github_repo");
  
  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

export async function fetchIssues(
  owner: string,
  repo: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string
): Promise<FeedItem[]> {
  const octokit = await getOctokit(token);
  
  if (!octokit) {
    console.warn("GitHub token not configured. Cannot fetch issues.");
    return [];
  }

  try {
    const items = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE),
    });

    return items.data.map((i): FeedItem => {
      const labels = extractLabels(i.labels);
      const repoId = formatRepoIdentifier(owner, repo);

      return {
        title: i.title,
        url: i.html_url,
        description: i.body || null,
        date: normalizeDateToIso(i.created_at),
        source: "github",
        imageUrl: null,
        metadata: {
          body: i.body ?? null,
          number: i.number,
          repo: repoId,
          labels,
        },
        itemType: "issue",
        connectionId: connectionId || null,
        resourceId: resourceId || null,
      };
    });
  } catch (error) {
    console.error(`Failed to fetch issues for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string
): Promise<FeedItem[]> {
  const octokit = await getOctokit(token);
  
  if (!octokit) {
    console.warn("GitHub token not configured. Cannot fetch pull requests.");
    return [];
  }

  try {
    const items = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      per_page: normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE),
    });

    return items.data.map((pr): FeedItem => {
      const labels = extractLabels(pr.labels);
      const repoId = formatRepoIdentifier(owner, repo);

      return {
        title: pr.title,
        url: pr.html_url,
        description: pr.body || null,
        date: normalizeDateToIso(pr.created_at),
        source: "github",
        imageUrl: null,
        metadata: {
          body: pr.body ?? null,
          number: pr.number,
          repo: repoId,
          labels,
        },
        itemType: "pull-request",
        connectionId: connectionId || null,
        resourceId: resourceId || null,
      };
    });
  } catch (error) {
    console.error(`Failed to fetch pull requests for ${owner}/${repo}:`, error);
    return [];
  }
}

export async function fetchGitHubFromConnectionResources(
  issuesPerRepo = 10,
  prsPerRepo = 5
): Promise<FeedItem[]> {

  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping GitHub: No active connection found");
    return [];
  }

  const repos = await getSelectedRepos(connection.id);
  if (repos.length === 0) {
    console.warn("⚠️  No selected GitHub repositories found");
    return [];
  }


  const allItems: FeedItem[] = [];

  for (const resource of repos) {
    const parsed = parseRepoIdentifier(resource.externalId);
    if (!parsed) continue;

    const { owner, repo } = parsed;

    try {
      const issues = await fetchIssues(
        owner,
        repo,
        issuesPerRepo,
        connection.id,
        resource.id,
        connection.token
      );

      const prs = await fetchPullRequests(
        owner,
        repo,
        prsPerRepo,
        connection.id,
        resource.id,
        connection.token
      );

      allItems.push(...issues, ...prs);
    } catch (error) {
      throw error;
    }
  }

  return allItems;
}
