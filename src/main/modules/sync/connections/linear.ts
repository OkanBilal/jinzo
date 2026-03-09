import { LinearClient } from "@linear/sdk";

import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithSecrets,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../sync.connection-utils";

const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 10;

interface LinearConnection {
  id: string;
  token: string;
}

interface LinearResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: Record<string, unknown>;
}

async function getCredentials(): Promise<string | null> {
  const connection = await getConnectionWithSecrets("linear");
  return connection?.secrets.apiKey || null;
}

async function getLinearClient(token?: string): Promise<LinearClient | null> {
  if (token) {
    return new LinearClient({ apiKey: token });
  }

  const linearToken = await getCredentials();
  if (linearToken) {
    return new LinearClient({ apiKey: linearToken });
  }
  return null;
}

async function getConnection(): Promise<LinearConnection | null> {
  const connection = await getConnectionWithSecrets("linear");
  if (!connection?.secrets.apiKey) return null;

  return {
    id: connection.id,
    token: connection.secrets.apiKey,
  };
}

async function getSelectedTeams(
  connectionId: string
): Promise<LinearResource[]> {
  const resources = await getSelectedResources(connectionId, "linear_team");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

function extractLabels(labels: { nodes: Array<{ name: string }> } | undefined): string[] {
  if (!labels?.nodes || !Array.isArray(labels.nodes)) return [];
  return labels.nodes.map((l) => l.name).filter(Boolean);
}

function parseIssueNumber(identifier: string): number | null {
  // Linear identifiers are like "ABC-123" - extract the number part
  const match = identifier.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export async function fetchLinearIssues(
  teamKey: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string
): Promise<EntityInput[]> {
  const client = await getLinearClient(token);

  if (!client) {
    console.warn("Linear token not configured. Cannot fetch issues.");
    return [];
  }

  try {
    // Find the team by key
    const teams = await client.teams({
      filter: { key: { eq: teamKey } },
    });

    const team = teams.nodes[0];
    if (!team) {
      console.warn(`Linear team with key "${teamKey}" not found.`);
      return [];
    }

    // Fetch issues for this team
    const issuesConnection = await team.issues({
      first: normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE),
      orderBy: LinearClient.prototype.constructor.name ? undefined : undefined, // Use default ordering
      filter: {
        // Only fetch non-canceled, non-completed issues (similar to GitHub's "open" filter)
        completedAt: { null: true },
        canceledAt: { null: true },
      },
    });

    const entities: EntityInput[] = [];

    for (const issue of issuesConnection.nodes) {
      // Fetch related data
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();

      const labelNames = extractLabels(labels);
      const issueNumber = parseIssueNumber(issue.identifier);
      const completedAt = issue.completedAt
        ? new Date(issue.completedAt).toISOString()
        : null;

      entities.push({
        kind: "issue",
        title: issue.title,
        url: issue.url,
        body: issue.description || null,
        summary: issue.description?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(issue.createdAt),
        externalId: issue.id,
        connectionId: connectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "linear",
          identifier: issue.identifier,
          number: issueNumber,
          teamKey: teamKey,
          repo: teamKey, // Use teamKey as "repo" for consistency with GitHub
          state: state?.name || "Unknown",
          labels: labelNames,
          assignee: assignee?.name || null,
          priority: issue.priority || 0,
          url: issue.url,
          updatedAt: issue.updatedAt
            ? new Date(issue.updatedAt).toISOString()
            : null,
          completedAt,
        },
      });
    }

    return entities;
  } catch (error) {
    console.error(`Failed to fetch Linear issues for team ${teamKey}:`, error);
    return [];
  }
}

export async function fetchLinearFromConnectionResources(
  issuesPerTeam = DEFAULT_LIMIT
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Linear: No active connection found");
    return [];
  }

  const teams = await getSelectedTeams(connection.id);
  if (teams.length === 0) {
    // If no teams are selected, try to fetch all issues from all teams
    console.warn("⚠️  No selected Linear teams found, fetching from all teams");
    return fetchAllLinearIssues(issuesPerTeam, connection.id, connection.token);
  }

  const allItems: EntityInput[] = [];

  for (const resource of teams) {
    const teamKey = resource.externalId;

    const issues = await fetchLinearIssues(
      teamKey,
      issuesPerTeam,
      connection.id,
      resource.id,
      connection.token
    );

    allItems.push(...issues);
  }

  return allItems;
}

async function fetchAllLinearIssues(
  limit: number,
  connectionId: string,
  token: string
): Promise<EntityInput[]> {
  const client = await getLinearClient(token);

  if (!client) {
    return [];
  }

  try {
    // Fetch issues directly without team filter
    const issuesConnection = await client.issues({
      first: normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE),
      filter: {
        completedAt: { null: true },
        canceledAt: { null: true },
      },
    });

    const entities: EntityInput[] = [];

    for (const issue of issuesConnection.nodes) {
      const state = await issue.state;
      const assignee = await issue.assignee;
      const labels = await issue.labels();
      const team = await issue.team;

      const labelNames = extractLabels(labels);
      const issueNumber = parseIssueNumber(issue.identifier);
      const teamKey = team?.key || "UNKNOWN";
      const completedAt = issue.completedAt
        ? new Date(issue.completedAt).toISOString()
        : null;

      entities.push({
        kind: "issue",
        title: issue.title,
        url: issue.url,
        body: issue.description || null,
        summary: issue.description?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(issue.createdAt),
        externalId: issue.id,
        connectionId: connectionId,
        resourceId: null,
        metadata: {
          provider: "linear",
          identifier: issue.identifier,
          number: issueNumber,
          teamKey: teamKey,
          repo: teamKey,
          state: state?.name || "Unknown",
          labels: labelNames,
          assignee: assignee?.name || null,
          priority: issue.priority || 0,
          url: issue.url,
          updatedAt: issue.updatedAt
            ? new Date(issue.updatedAt).toISOString()
            : null,
          completedAt,
        },
      });
    }

    return entities;
  } catch (error) {
    console.error("Failed to fetch Linear issues:", error);
    return [];
  }
}
