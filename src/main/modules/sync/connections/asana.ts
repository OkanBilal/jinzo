/**
 * Asana Connection Fetcher
 *
 * Fetches tasks from Asana using REST API.
 * Authentication uses Personal Access Token (PAT).
 *
 * Asana-specific assumptions:
 * - Uses Asana REST API v1.0 (https://app.asana.com/api/1.0/)
 * - Credentials stored as: accessToken = PAT
 * - Projects are stored as connectionResources with kind = "asana_project"
 * - Tasks are normalized to EntityInput with provider = "asana" and kind = "issue"
 */

import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithTokens,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../sync.connection-utils";

const ASANA_BASE_URL = "https://app.asana.com/api/1.0";
const MAX_ITEMS_PER_PAGE = 100;
const DEFAULT_LIMIT = 20;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AsanaConnection {
  id: string;
  token: string;
}

interface AsanaResource {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  metadata: Record<string, unknown>;
}

interface AsanaUser {
  gid: string;
  name: string;
}

interface AsanaProject {
  gid: string;
  name: string;
}

interface AsanaWorkspace {
  gid: string;
  name: string;
}

interface AsanaTag {
  gid: string;
  name: string;
}

interface AsanaTask {
  gid: string;
  name: string;
  notes: string | null;
  permalink_url: string;
  created_at: string;
  modified_at: string;
  completed: boolean;
  completed_at: string | null;
  due_on: string | null;
  due_at: string | null;
  assignee: AsanaUser | null;
  projects: AsanaProject[];
  workspace: AsanaWorkspace;
  tags: AsanaTag[];
}

interface AsanaTasksResponse {
  data: AsanaTask[];
  next_page: {
    offset: string;
    path: string;
    uri: string;
  } | null;
}

export interface AsanaProjectInfo {
  gid: string;
  name: string;
  archived: boolean;
  color: string | null;
  created_at: string;
  modified_at: string;
  workspace: {
    gid: string;
    name: string;
  };
  team?: {
    gid: string;
    name: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

// ─────────────────────────────────────────────────────────────
// Connection & Credentials
// ─────────────────────────────────────────────────────────────

async function getConnection(): Promise<AsanaConnection | null> {
  const connection = await getConnectionWithTokens("asana");
  if (!connection?.accessToken) return null;

  return {
    id: connection.id,
    token: connection.accessToken,
  };
}

async function getSelectedProjects(
  connectionId: string
): Promise<AsanaResource[]> {
  const resources = await getSelectedResources(connectionId, "asana_project");

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
 * Fetch available workspaces from Asana
 */
export async function fetchAsanaWorkspaces(
  token: string
): Promise<Array<{ gid: string; name: string }>> {
  try {
    const response = await fetch(`${ASANA_BASE_URL}/workspaces`, {
      headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Asana API error (${response.status}):`, error);
      throw new Error(`Asana API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch Asana workspaces:", error);
    throw error;
  }
}

/**
 * Fetch available projects from Asana
 */
export async function fetchAsanaProjects(
  token: string,
  workspaceGid?: string
): Promise<AsanaProjectInfo[]> {
  try {
    // If no workspace specified, fetch from all workspaces
    let url = `${ASANA_BASE_URL}/projects?opt_fields=gid,name,archived,color,created_at,modified_at,workspace.gid,workspace.name,team.gid,team.name&limit=100`;

    if (workspaceGid) {
      url += `&workspace=${workspaceGid}`;
    }

    const response = await fetch(url, {
      headers: buildAuthHeaders(token),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Asana API error (${response.status}):`, error);
      throw new Error(`Asana API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.data || []).filter((p: AsanaProjectInfo) => !p.archived);
  } catch (error) {
    console.error("Failed to fetch Asana projects:", error);
    throw error;
  }
}

/**
 * Fetch tasks from a specific Asana project
 */
export async function fetchAsanaTasks(
  projectGid: string,
  limit = DEFAULT_LIMIT,
  connectionId?: string,
  resourceId?: string,
  token?: string
): Promise<EntityInput[]> {
  // If token not provided, get from connection
  let actualToken = token;
  let actualConnectionId = connectionId;

  if (!actualToken) {
    const connection = await getConnection();
    if (!connection) {
      console.warn("Asana token not configured. Cannot fetch tasks.");
      return [];
    }
    actualToken = connection.token;
    actualConnectionId = actualConnectionId || connection.id;
  }

  const normalizedLimit = normalizeLimit(limit, 1, MAX_ITEMS_PER_PAGE);

  // Fetch task fields in one call using opt_fields to avoid N+1 calls
  const optFields = [
    "gid",
    "name",
    "notes",
    "permalink_url",
    "created_at",
    "modified_at",
    "completed",
    "completed_at",
    "due_on",
    "due_at",
    "assignee.name",
    "assignee.gid",
    "projects.gid",
    "projects.name",
    "workspace.gid",
    "workspace.name",
    "tags.name",
    "tags.gid",
  ].join(",");

  try {
    // Fetch incomplete tasks from the project, sorted by modified_at desc
    const url = `${ASANA_BASE_URL}/projects/${projectGid}/tasks?opt_fields=${optFields}&completed_since=now&limit=${normalizedLimit}`;

    const response = await fetch(url, {
      headers: buildAuthHeaders(actualToken),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Asana API error (${response.status}):`, error);
      return [];
    }

    const data: AsanaTasksResponse = await response.json();

    return data.data.map((task): EntityInput => {
      const workspaceGid = task.workspace?.gid || "";
      const tagNames = (task.tags || []).map((t) => t.name);

      return {
        kind: "issue",
        title: task.name,
        url: task.permalink_url,
        body: task.notes || null,
        summary: task.notes?.substring(0, 500) || null,
        occurredAt: normalizeDateToIso(task.created_at),
        externalId: `${projectGid}#${task.gid}`,
        connectionId: actualConnectionId || null,
        resourceId: resourceId || null,
        metadata: {
          provider: "asana",
          taskGid: task.gid,
          projectGid,
          workspaceGid,
          completed: task.completed,
          completedAt: task.completed_at,
          dueOn: task.due_on,
          dueAt: task.due_at,
          assignee: task.assignee
            ? { gid: task.assignee.gid, name: task.assignee.name }
            : null,
          modifiedAt: task.modified_at
            ? new Date(task.modified_at).toISOString()
            : null,
          tags: tagNames,
          // For compatibility with existing issue table columns
          repo: projectGid,
          number: parseInt(task.gid, 10) || 0,
          state: task.completed ? "completed" : "open",
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch Asana tasks for project ${projectGid}:`, error);
    return [];
  }
}

/**
 * Main entry point: Fetch tasks from all selected Asana projects
 */
export async function fetchAsanaFromConnectionResources(
  tasksPerProject = DEFAULT_LIMIT
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Asana: No active connection found");
    return [];
  }

  const projects = await getSelectedProjects(connection.id);
  if (projects.length === 0) {
    console.warn("⚠️  No selected Asana projects found");
    return [];
  }

  const allItems: EntityInput[] = [];

  // Execute sequentially to avoid rate limits
  for (const resource of projects) {
    const projectGid = resource.externalId;

    const tasks = await fetchAsanaTasks(
      projectGid,
      tasksPerProject,
      connection.id,
      resource.id,
      connection.token
    );

    allItems.push(...tasks);
  }

  return allItems;
}
