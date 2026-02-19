import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../sync.connection-utils";

const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 5;
const DEFAULT_DOMAIN = "gitlab.com";

interface GitLabConnection {
  id: string;
  token: string;
  domain: string;
}

interface GitLabResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: any;
}

function getBaseUrl(domain: string): string {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${cleanDomain}/api/v4`;
}

async function getConnection(): Promise<GitLabConnection | null> {
  const connection = await getConnectionWithTokens("gitlab");
  if (!connection?.accessToken) return null;

  const domain = (connection.metadata?.domain as string) || DEFAULT_DOMAIN;

  return {
    id: connection.id,
    token: connection.accessToken,
    domain,
  };
}

async function getSelectedProjects(
  connectionId: string
): Promise<GitLabResource[]> {
  const resources = await getSelectedResources(connectionId, "gitlab_project");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

function extractLabels(labels: any[]): string[] {
  if (!Array.isArray(labels)) return [];
  return labels.filter((s): s is string => typeof s === "string");
}

/**
 * Resolve relative GitLab image/file URLs to absolute and strip
 * GitLab-flavored `{width=... height=...}` size annotations.
 *
 * `![alt](/uploads/hash/file.png){width=900 height=569}`
 * → `![alt](https://domain/-/project/projectId/uploads/hash/file.png)`
 */
function resolveGitlabBody(
  body: string | null,
  domain: string,
  projectId: string
): string | null {
  if (!body) return null;
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return body.replace(
    /!\[([^\]]*)\]\((\/uploads\/[^)]+)\)(\{[^}]*\})?/g,
    (_match, alt, path) =>
      `![${alt}](https://${cleanDomain}/-/project/${projectId}${path})`
  );
}

export async function fetchGitlabIssues(
  projectId: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string,
  domain = DEFAULT_DOMAIN
): Promise<EntityInput[]> {
  if (!token) {
    console.warn("GitLab token not provided. Cannot fetch issues.");
    return [];
  }

  const baseUrl = getBaseUrl(domain);
  const perPage = normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE);

  try {
    const response = await fetch(
      `${baseUrl}/projects/${encodeURIComponent(projectId)}/issues?state=opened&per_page=${perPage}`,
      {
        headers: {
          "PRIVATE-TOKEN": token,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitLab API error (${response.status}):`, errorText);
      return [];
    }

    const issues = await response.json();

    return issues.map((issue: any): EntityInput => {
      const labels = extractLabels(issue.labels);
      const resolvedBody = resolveGitlabBody(issue.description, domain, projectId);

      return {
        kind: "issue",
        title: issue.title,
        url: issue.web_url,
        body: resolvedBody,
        summary: issue.description?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(issue.created_at),
        externalId: `gitlab:${projectId}#${issue.iid}`,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "gitlab",
          iid: issue.iid,
          projectId,
          labels,
          state: issue.state,
          assignee: issue.assignee?.username || null,
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch GitLab issues for project ${projectId}:`, error);
    return [];
  }
}

export async function fetchGitlabMergeRequests(
  projectId: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string,
  domain = DEFAULT_DOMAIN
): Promise<EntityInput[]> {
  if (!token) {
    console.warn("GitLab token not provided. Cannot fetch merge requests.");
    return [];
  }

  const baseUrl = getBaseUrl(domain);
  const perPage = normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE);

  try {
    const response = await fetch(
      `${baseUrl}/projects/${encodeURIComponent(projectId)}/merge_requests?state=opened&per_page=${perPage}`,
      {
        headers: {
          "PRIVATE-TOKEN": token,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitLab API error (${response.status}):`, errorText);
      return [];
    }

    const mergeRequests = await response.json();

    return mergeRequests.map((mr: any): EntityInput => {
      const labels = extractLabels(mr.labels);
      const resolvedBody = resolveGitlabBody(mr.description, domain, projectId);

      return {
        kind: "merge_request",
        title: mr.title,
        url: mr.web_url,
        body: resolvedBody,
        summary: mr.description?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(mr.created_at),
        externalId: `gitlab:${projectId}!${mr.iid}`,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "gitlab",
          iid: mr.iid,
          projectId,
          labels,
          state: mr.state,
          draft: mr.draft ?? false,
          assignee: mr.assignee?.username || null,
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch GitLab merge requests for project ${projectId}:`, error);
    return [];
  }
}

export async function fetchGitlabFromConnectionResources(
  issuesPerProject = 10,
  mrsPerProject = 5
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("Skipping GitLab: No active connection found");
    return [];
  }

  const projects = await getSelectedProjects(connection.id);
  if (projects.length === 0) {
    console.warn("No selected GitLab projects found");
    return [];
  }

  const allItems: EntityInput[] = [];

  for (const resource of projects) {
    const projectId = resource.externalId;

    const issues = await fetchGitlabIssues(
      projectId,
      issuesPerProject,
      connection.id,
      resource.id,
      connection.token,
      connection.domain
    );

    const mrs = await fetchGitlabMergeRequests(
      projectId,
      mrsPerProject,
      connection.id,
      resource.id,
      connection.token,
      connection.domain
    );

    allItems.push(...issues, ...mrs);
  }

  return allItems;
}
