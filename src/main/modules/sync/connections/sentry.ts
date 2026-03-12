import type { EntityInput } from "../sync.dto";
import {
  getConnectionWithSecrets,
  getSelectedResources,
  normalizeLimit,
  normalizeDateToIso,
} from "../sync.connection-utils";

const DEFAULT_LIMIT = 50;
const SENTRY_API_BASE = "https://sentry.io/api/0";

interface SentryConnection {
  id: string;
  token: string;
  organization?: string;
}

interface SentryResource {
  id: string;
  connectionId: string;
  externalId: string; // "org/project" format
  name: string;
  metadata: Record<string, unknown>;
}

async function getConnection(): Promise<SentryConnection | null> {
  const connection = await getConnectionWithSecrets("sentry");
  if (!connection?.secrets.token) return null;

  return {
    id: connection.id,
    token: connection.secrets.token,
    organization: connection.metadata?.organization as string | undefined,
  };
}

async function getSelectedProjects(
  connectionId: string,
): Promise<SentryResource[]> {
  const resources = await getSelectedResources(connectionId, "sentry_project");

  return resources.map((r) => ({
    id: r.id,
    connectionId: r.connectionId,
    externalId: r.externalId,
    name: r.name,
    metadata: r.metadata,
  }));
}

function parseSentryLevel(level: string): string {
  const map: Record<string, string> = {
    fatal: "fatal",
    error: "error",
    warning: "warning",
    info: "info",
    debug: "info",
  };
  return map[level] || "error";
}

function parseSentryCategory(type: string): string {
  const map: Record<string, string> = {
    error: "exception",
    default: "bug",
    csp: "alert",
    hpkp: "alert",
    expectct: "alert",
    expectstaple: "alert",
    transaction: "other",
  };
  return map[type] || "bug";
}

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  permalink: string;
  shortId: string;
  level: string;
  status: string;
  type: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  metadata: {
    value?: string;
    type?: string;
    filename?: string;
    function?: string;
  };
  assignedTo?: {
    name?: string;
    email?: string;
  } | null;
  project: {
    slug: string;
    name: string;
  };
}

async function fetchSentryIssues(
  token: string,
  orgSlug: string,
  projectSlug: string,
  limit: number,
  connectionId: string,
  resourceId: string,
): Promise<EntityInput[]> {
  const url = `${SENTRY_API_BASE}/projects/${orgSlug}/${projectSlug}/issues/?query=is:unresolved&sort=date&limit=${normalizeLimit(limit, 1, 100)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Sentry API error ${response.status}: ${response.statusText}`);
      return [];
    }

    const issues = (await response.json()) as SentryIssue[];

    return issues.map((issue): EntityInput => {
      const sentryState =
        issue.status === "resolved" ? "resolved"
        : issue.status === "ignored" ? "ignored"
        : "open";

      return {
        kind: "signal",
        title: issue.title,
        url: issue.permalink,
        body: issue.metadata?.value || null,
        summary: `${issue.metadata?.type || "Error"}: ${issue.title}`.substring(0, 500),
        occurredAt: normalizeDateToIso(issue.firstSeen),
        externalId: issue.id,
        connectionId,
        resourceId,
        metadata: {
          source: "sentry",
          level: parseSentryLevel(issue.level),
          category: parseSentryCategory(issue.type),
          state: sentryState,
          eventCount: parseInt(issue.count, 10) || 1,
          affectedUsers: issue.userCount ?? 0,
          firstSeenAt: issue.firstSeen,
          lastSeenAt: issue.lastSeen,
          file: issue.metadata?.filename ?? "",
          function: issue.metadata?.function || issue.culprit || "",
          assignee: issue.assignedTo?.name || issue.assignedTo?.email || "",
          shortId: issue.shortId,
          projectSlug: issue.project?.slug ?? "",
          projectName: issue.project?.name ?? "",
          exceptionType: issue.metadata?.type ?? "",
        },
      };
    });
  } catch (error) {
    console.error(`Failed to fetch Sentry issues for ${orgSlug}/${projectSlug}:`, error);
    return [];
  }
}

export async function fetchSentryFromConnectionResources(
  limit = DEFAULT_LIMIT,
): Promise<EntityInput[]> {
  const connection = await getConnection();
  if (!connection) {
    console.warn("⚠️  Skipping Sentry: No active connection found");
    return [];
  }

  const projects = await getSelectedProjects(connection.id);
  if (projects.length === 0) {
    console.warn("⚠️  No selected Sentry projects found");
    return [];
  }

  const orgSlug = connection.organization;
  if (!orgSlug) {
    console.warn("⚠️  Sentry connection missing organization slug");
    return [];
  }

  const allItems: EntityInput[] = [];

  for (const project of projects) {
    const projectSlug = project.externalId;
    const items = await fetchSentryIssues(
      connection.token,
      orgSlug,
      projectSlug,
      limit,
      connection.id,
      project.id,
    );

    allItems.push(...items);
  }

  return allItems;
}
