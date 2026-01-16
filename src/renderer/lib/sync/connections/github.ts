import { Octokit } from "@octokit/rest";

import type { EntityInput } from "..";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../connection-utils";

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
): Promise<EntityInput[]> {
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

    return items.data.map((i): EntityInput => {
      const labels = extractLabels(i.labels);
      const repoId = formatRepoIdentifier(owner, repo);

      return {
        kind: "issue",
        title: i.title,
        url: i.html_url,
        body: i.body || null,
        summary: i.body?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(i.created_at),
        externalId: `${repoId}#${i.number}`,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "github",
          number: i.number,
          repo: repoId,
          labels,
          state: i.state,
          assignee: i.assignee?.login || null,
        },
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
): Promise<EntityInput[]> {
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

    return items.data.map((pr): EntityInput => {
      const labels = extractLabels(pr.labels);
      const repoId = formatRepoIdentifier(owner, repo);

      return {
        kind: "pull_request",
        title: pr.title,
        url: pr.html_url,
        body: pr.body || null,
        summary: pr.body?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(pr.created_at),
        externalId: `${repoId}#${pr.number}`,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "github",
          number: pr.number,
          repo: repoId,
          labels,
          state: pr.state,
          draft: pr.draft,
          mergeable: pr.mergeable,
        },
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
): Promise<EntityInput[]> {

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


  const allItems: EntityInput[] = [];

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
