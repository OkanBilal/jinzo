/**
 * Jira Connection Fetcher
 *
 * Fetches issues from Jira Cloud using REST API v3.
 * Authentication uses Basic auth with email:api_token.
 *
 * Jira-specific assumptions:
 * - Uses Jira Cloud REST API v3 (https://{domain}.atlassian.net/rest/api/3/)
 * - Credentials stored as: accessToken = apiToken, metadata = { domain, email }
 * - Projects are stored as connectionResources with kind = "jira_project"
 * - Issues are normalized to EntityInput with provider = "jira"
 */

import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
  safeJsonParse,
} from "../sync.connection-utils";

const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 20;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface JiraConnection {
  id: string;
  token: string;
  domain: string;
  email: string;
}

interface JiraResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | null;
    status: {
      name: string;
      statusCategory?: {
        key: string;
      };
    };
    issuetype: {
      name: string;
      iconUrl?: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress?: string;
    } | null;
    reporter?: {
      displayName: string;
    };
    labels?: string[];
    created: string;
    updated: string;
    duedate?: string | null;
    project: {
      key: string;
      name: string;
    };
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls?: {
    "48x48"?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function buildBaseUrl(domain: string): string {
  // Ensure domain doesn't have protocol or trailing slash
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://${cleanDomain}/rest/api/3`;
}

function buildAuthHeader(email: string, token: string): string {
  const credentials = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${credentials}`;
}

function extractTextFromADF(adfContent: unknown): string {
  // Atlassian Document Format (ADF) is used in Jira Cloud
  // This extracts plain text from ADF content
  if (!adfContent || typeof adfContent !== "object") {
    return "";
  }

  const adf = adfContent as Record<string, unknown>;

  if (adf.type === "doc" && Array.isArray(adf.content)) {
    return adf.content
      .map((node: unknown) => extractTextFromADF(node))
      .join("\n");
  }

  if (adf.type === "paragraph" && Array.isArray(adf.content)) {
    return adf.content
      .map((node: unknown) => {
        if (typeof node === "object" && node !== null) {
          const textNode = node as Record<string, unknown>;
          if (textNode.type === "text" && typeof textNode.text === "string") {
            return textNode.text;
          }
        }
        return "";
      })
      .join("");
  }

  if (adf.type === "text" && typeof adf.text === "string") {
    return adf.text;
  }

  return "";
}

// ─────────────────────────────────────────────────────────────
// Connection & Credentials
// ─────────────────────────────────────────────────────────────

async function getConnection(): Promise<JiraConnection | null> {
  const connection = await getConnectionWithTokens("jira");
  if (!connection?.accessToken) return null;

  const metadata = connection.metadata || {};
  const domain = metadata.domain as string;
  const email = metadata.email as string;

  if (!domain || !email) {
    console.warn("⚠️  Jira connection missing domain or email in metadata");
    return null;
  }

  return {
    id: connection.id,
    token: connection.accessToken,
    domain,
    email,
  };
}

async function getSelectedProjects(
  connectionId: string
): Promise<JiraResource[]> {
  const resources = await getSelectedResources(connectionId, "jira_project");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

/**
 * Fetch available projects from Jira
 */
export async function fetchJiraProjects(
  domain: string,
  email: string,
  token: string
): Promise<JiraProject[]> {
  const baseUrl = buildBaseUrl(domain);
  const authHeader = buildAuthHeader(email, token);

  try {
    const response = await fetch(`${baseUrl}/project/search?maxResults=100`, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Jira API error (${response.status}):`, error);
      throw new Error(`Jira API error: ${response.status}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Failed to fetch Jira projects:", error);
    throw error;
  }
}

/**
 * Fetch issues from a specific Jira project
 */
export async function fetchJiraIssues(
  projectKey: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  domain?: string,
  email?: string,
  token?: string
): Promise<EntityInput[]> {
  // If credentials not provided, get from connection
  let actualDomain = domain;
  let actualEmail = email;
  let actualToken = token;

  if (!actualDomain || !actualEmail || !actualToken) {
    const connection = await getConnection();
    if (!connection) {
      console.warn("Jira credentials not configured. Cannot fetch issues.");
      return [];
    }
    actualDomain = connection.domain;
    actualEmail = connection.email;
    actualToken = connection.token;
    connectionId = connectionId || connection.id;
  }

  const baseUrl = buildBaseUrl(actualDomain);
  const authHeader = buildAuthHeader(actualEmail, actualToken);

  try {
    // JQL query: Get non-resolved issues from the project, ordered by updated
    // Using the new /search/jql endpoint (the old /search endpoint is deprecated)
    const jql = `project = "${projectKey}" AND resolution = Unresolved ORDER BY updated DESC`;

    const response = await fetch(
      `${baseUrl}/search/jql`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql,
          maxResults: normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE),
          fields: ["summary", "description", "status", "issuetype", "priority", "assignee", "reporter", "labels", "created", "updated", "duedate", "project"],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`Jira API error (${response.status}):`, error);
      return [];
    }

    const data: JiraSearchResponse = await response.json();

    return data.issues.map((issue): EntityInput => {
      // Extract description text (may be ADF or plain string)
      let description: string | null = null;
      if (issue.fields.description) {
        if (typeof issue.fields.description === "string") {
          description = issue.fields.description;
        } else {
          description = extractTextFromADF(issue.fields.description);
        }
      }

      // Build the issue URL
      const issueUrl = `https://${actualDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/browse/${issue.key}`;

      return {
        kind: "issue",
        title: issue.fields.summary,
        url: issueUrl,
        body: description,
        summary: description?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(issue.fields.created),
        externalId: issue.key,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "jira",
          key: issue.key,
          id: issue.id,
          projectKey: issue.fields.project.key,
          projectName: issue.fields.project.name,
          // For compatibility with existing issue table columns
          repo: issue.fields.project.key,
          number: parseInt(issue.key.split("-")[1], 10) || 0,
          state: issue.fields.status.name,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory?.key || null,
          type: issue.fields.issuetype.name,
          priority: issue.fields.priority?.name || null,
          priorityId: issue.fields.priority?.id || null,
          assignee: issue.fields.assignee?.displayName || null,
          reporter: issue.fields.reporter?.displayName || null,
          labels: issue.fields.labels || [],
          url: issueUrl,
          updatedAt: issue.fields.updated
            ? new Date(issue.fields.updated).toISOString()
            : null,
          dueDate: issue.fields.duedate || null,
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch Jira issues for project ${projectKey}:`, error);
    return [];
  }
}

/**
 * Main entry point: Fetch issues from all selected Jira projects
 */
export async function fetchJiraFromConnectionResources(
  issuesPerProject = DEFAULT_LIMIT
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Jira: No active connection found");
    return [];
  }

  const projects = await getSelectedProjects(connection.id);
  if (projects.length === 0) {
    console.warn("⚠️  No selected Jira projects found");
    return [];
  }

  const allItems: EntityInput[] = [];

  for (const resource of projects) {
    const projectKey = resource.externalId;

    const issues = await fetchJiraIssues(
      projectKey,
      issuesPerProject,
      connection.id,
      resource.id,
      connection.domain,
      connection.email,
      connection.token
    );

    allItems.push(...issues);
  }

  return allItems;
}
