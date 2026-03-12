import { Octokit } from "@octokit/rest";
import { LinearClient } from "@linear/sdk";
import { connectionsRepo } from "./connections.repo";
import {
  parseConnectionMetadata,
  parseResourceMetadata,
} from "./connections.utils";
import { decryptSecrets } from "../connectionCredentials/connectionCredentials.utils";
import type {
  GithubRepo,
  LinearTeam,
  JiraProject,
  AsanaProject,
  GitlabProject,
  TrelloBoard,
  SentryProject,
  SaveResourcesPayload,
  ServiceResponse,
} from "./connections.dto";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type ConnectionAndSecrets =
  | { ok: true; connection: NonNullable<Awaited<ReturnType<typeof connectionsRepo.findById>>>; secrets: Record<string, string> }
  | { ok: false; error: string };

async function getConnectionAndSecrets(connectionId: string): Promise<ConnectionAndSecrets> {
  const connection = await connectionsRepo.findById(connectionId);
  if (!connection) return { ok: false, error: "Connection not found" };

  const token = await connectionsRepo.findCurrentToken(connectionId);
  if (!token?.accessTokenEnc) return { ok: false, error: "Token not found" };

  return { ok: true, connection, secrets: decryptSecrets(token.accessTokenEnc as Buffer) };
}

async function upsertConnectionResource(params: {
  connectionId: string;
  externalId: string;
  kind: string;
  name: string;
  metadata: Record<string, unknown>;
  url?: string;
}): Promise<void> {
  const { connectionId, externalId, kind, name, metadata, url } = params;
  const resourceId = `${connectionId}:${externalId}`;
  const metadataJson = JSON.stringify(metadata);

  const existing = await connectionsRepo.findResourceByExternalId(connectionId, externalId);

  if (existing) {
    await connectionsRepo.updateResource(existing.id, { selected: true, lastSeenAt: new Date(), metadata: metadataJson });
  } else {
    await connectionsRepo.insertResource({
      id: resourceId,
      connectionId,
      externalId,
      kind,
      name,
      url,
      selected: true,
      metadata: metadataJson,
      lastSeenAt: new Date(),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Provider configs
// ─────────────────────────────────────────────────────────────

type ResourceMapper = (resource: any) => {
  externalId: string;
  kind: string;
  name: string;
  url?: string;
  metadata: Record<string, unknown>;
};

const RESOURCE_MAPPERS: Record<string, ResourceMapper> = {
  github: (repo: GithubRepo) => ({
    externalId: repo.fullName,
    kind: "github_repo",
    name: repo.fullName,
    url: repo.htmlUrl,
    metadata: { private: repo.private, description: repo.description, language: repo.language, stars: repo.stars, forks: repo.forks, defaultBranch: repo.defaultBranch, htmlUrl: repo.htmlUrl, updatedAt: repo.updatedAt },
  }),
  linear: (team: LinearTeam) => ({
    externalId: team.key,
    kind: "linear_team",
    name: team.name,
    url: team.url,
    metadata: { id: team.id, name: team.name, key: team.key, description: team.description, icon: team.icon, color: team.color, private: team.private, updatedAt: team.updatedAt },
  }),
  jira: (project: JiraProject) => ({
    externalId: project.key,
    kind: "jira_project",
    name: project.name,
    url: project.url,
    metadata: { id: project.id, name: project.name, key: project.key, projectTypeKey: project.projectTypeKey, avatarUrl: project.avatarUrl, description: project.description, isPrivate: project.isPrivate },
  }),
  asana: (project: AsanaProject) => ({
    externalId: project.gid,
    kind: "asana_project",
    name: project.name,
    url: project.url,
    metadata: { gid: project.gid, name: project.name, color: project.color, workspaceGid: project.workspaceGid, workspaceName: project.workspaceName, teamGid: project.teamGid, teamName: project.teamName, modifiedAt: project.modifiedAt, public: project.public },
  }),
  gitlab: (project: GitlabProject) => ({
    externalId: String(project.id),
    kind: "gitlab_project",
    name: project.pathWithNamespace,
    url: project.webUrl,
    metadata: { private: project.private, visibility: project.visibility, description: project.description, stars: project.stars, forks: project.forks, defaultBranch: project.defaultBranch, htmlUrl: project.webUrl, lastActivityAt: project.lastActivityAt, pathWithNamespace: project.pathWithNamespace },
  }),
  trello: (board: TrelloBoard) => ({
    externalId: board.id,
    kind: "trello_board",
    name: board.name,
    url: board.shortUrl,
    metadata: { id: board.id, name: board.name, shortLink: board.shortLink, desc: board.desc, closed: board.closed, organizationName: board.organizationName },
  }),
  sentry: (project: SentryProject) => ({
    externalId: project.slug,
    kind: "sentry_project",
    name: project.name,
    metadata: { id: project.id, slug: project.slug, name: project.name, platform: project.platform, dateCreated: project.dateCreated, status: project.status, organization: project.organization },
  }),
};

const SELECTED_RESOURCE_CONFIGS: Record<string, {
  kind: string;
  responseKey: string;
  formatItem: (r: any) => Record<string, unknown>;
}> = {
  github: {
    kind: "github_repo",
    responseKey: "repos",
    formatItem: (r) => ({ id: r.id, fullName: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  linear: {
    kind: "linear_team",
    responseKey: "teams",
    formatItem: (r) => ({ id: r.id, key: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  jira: {
    kind: "jira_project",
    responseKey: "projects",
    formatItem: (r) => ({ id: r.id, key: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  asana: {
    kind: "asana_project",
    responseKey: "projects",
    formatItem: (r) => ({ id: r.id, gid: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  gitlab: {
    kind: "gitlab_project",
    responseKey: "projects",
    formatItem: (r) => ({ id: r.id, externalId: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  trello: {
    kind: "trello_board",
    responseKey: "boards",
    formatItem: (r) => ({ id: r.id, boardId: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
  sentry: {
    kind: "sentry_project",
    responseKey: "projects",
    formatItem: (r) => ({ id: r.id, slug: r.externalId, name: r.name || r.externalId, metadata: parseResourceMetadata(r.metadata) }),
  },
};

// ─────────────────────────────────────────────────────────────
// Connections Service
// ─────────────────────────────────────────────────────────────
export const connectionsService = {
  // GitHub
  async getGithubRepos(connectionId: string): Promise<ServiceResponse<{ repos: GithubRepo[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const octokit = new Octokit({ auth: result.secrets.token });
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 100,
        affiliation: "owner,collaborator",
      });

      const formattedRepos: GithubRepo[] = repos.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        defaultBranch: repo.default_branch,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at,
      }));

      return { success: true, data: { repos: formattedRepos } };
    } catch (error) {
      console.error("Error fetching GitHub repos:", error);
      return { success: false, error: "Failed to fetch repositories" };
    }
  },

  // Linear
  async getLinearTeams(connectionId: string): Promise<ServiceResponse<{ teams: LinearTeam[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const linearClient = new LinearClient({ apiKey: result.secrets.apiKey });
      const [teamsConnection, organization] = await Promise.all([linearClient.teams(), linearClient.organization]);
      const orgUrlKey = organization.urlKey;

      const formattedTeams: LinearTeam[] = teamsConnection.nodes.map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
        description: team.description || null,
        icon: team.icon || null,
        color: team.color || null,
        private: team.private,
        updatedAt: team.updatedAt ? new Date(team.updatedAt).toISOString() : null,
        url: `https://linear.app/${orgUrlKey}/team/${team.key}`,
      }));

      return { success: true, data: { teams: formattedTeams } };
    } catch (error: any) {
      console.error("Error fetching Linear teams:", error);
      console.error("Linear error details:", { message: error?.message, type: error?.type, errors: error?.errors });
      return { success: false, error: error?.message || "Failed to fetch teams" };
    }
  },

  // Jira
  async getJiraProjects(connectionId: string): Promise<ServiceResponse<{ projects: JiraProject[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const metadata = result.connection.metadata ? JSON.parse(result.connection.metadata) : {};
      const domain = metadata.domain as string;
      const email = metadata.email as string;

      if (!domain || !email) {
        return { success: false, error: "Jira domain and email are required in connection metadata" };
      }

      const credentials = Buffer.from(`${email}:${result.secrets.apiToken}`).toString("base64");
      const baseUrl = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/rest/api/3`;

      const response = await fetch(`${baseUrl}/project/search?maxResults=100`, {
        headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Jira API error (${response.status}):`, errorText);
        return { success: false, error: `Jira API error: ${response.status}` };
      }

      const data: any = await response.json();
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const formattedProjects: JiraProject[] = (data.values || []).map(
        (project: Record<string, unknown>) => ({
          id: project.id as string,
          key: project.key as string,
          name: project.name as string,
          projectTypeKey: project.projectTypeKey as string,
          avatarUrl: (project.avatarUrls as Record<string, string>)?.["48x48"] || null,
          description: (project.description as string) || null,
          isPrivate: (project.isPrivate as boolean) ?? false,
          url: `https://${cleanDomain}/browse/${project.key}`,
        })
      );

      return { success: true, data: { projects: formattedProjects } };
    } catch (error: any) {
      console.error("Error fetching Jira projects:", error);
      return { success: false, error: error?.message || "Failed to fetch projects" };
    }
  },

  // Asana
  async getAsanaProjects(connectionId: string): Promise<ServiceResponse<{ projects: AsanaProject[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const headers = { Authorization: `Bearer ${result.secrets.accessToken}`, Accept: "application/json" };

      const workspacesResponse = await fetch("https://app.asana.com/api/1.0/workspaces", { headers });

      if (!workspacesResponse.ok) {
        const errorText = await workspacesResponse.text();
        console.error(`Asana API error fetching workspaces (${workspacesResponse.status}):`, errorText);
        return { success: false, error: `Asana API error: ${workspacesResponse.status}` };
      }

      const workspacesData: any = await workspacesResponse.json();
      const workspaces = workspacesData.data || [];

      if (workspaces.length === 0) return { success: true, data: { projects: [] } };

      const allProjects: AsanaProject[] = [];

      for (const workspace of workspaces) {
        const workspaceGid = workspace.gid as string;
        const workspaceName = workspace.name as string;

        const url = `https://app.asana.com/api/1.0/workspaces/${workspaceGid}/projects?opt_fields=gid,name,archived,color,modified_at,public,team.gid,team.name&limit=100`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
          console.error(`Asana API error fetching projects for workspace ${workspaceGid}:`, await response.text());
          continue;
        }

        const data: any = await response.json();
        const projects = (data.data || [])
          .filter((project: Record<string, unknown>) => !project.archived)
          .map((project: Record<string, unknown>) => {
            const team = project.team as Record<string, unknown> | null;
            return {
              gid: project.gid as string,
              name: project.name as string,
              archived: project.archived as boolean,
              color: (project.color as string) || null,
              workspaceGid,
              workspaceName,
              teamGid: team?.gid as string || null,
              teamName: team?.name as string || null,
              modifiedAt: (project.modified_at as string) || null,
              public: (project.public as boolean) ?? false,
              url: `https://app.asana.com/0/${project.gid}`,
            };
          });

        allProjects.push(...projects);
      }

      return { success: true, data: { projects: allProjects } };
    } catch (error: any) {
      console.error("Error fetching Asana projects:", error);
      return { success: false, error: error?.message || "Failed to fetch projects" };
    }
  },

  // GitLab
  async getGitlabProjects(connectionId: string): Promise<ServiceResponse<{ projects: GitlabProject[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const metadata = result.connection.metadata ? JSON.parse(result.connection.metadata) : {};
      const domain = (metadata.domain as string) || "gitlab.com";
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const baseUrl = `https://${cleanDomain}/api/v4`;

      const response = await fetch(
        `${baseUrl}/projects?membership=true&per_page=100&order_by=last_activity_at`,
        { headers: { "PRIVATE-TOKEN": result.secrets.token, Accept: "application/json" } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GitLab API error (${response.status}):`, errorText);
        return { success: false, error: `GitLab API error: ${response.status}` };
      }

      const data: any = await response.json();
      const formattedProjects: GitlabProject[] = (data || []).map(
        (project: Record<string, unknown>) => ({
          id: project.id as number,
          name: project.name as string,
          pathWithNamespace: project.path_with_namespace as string,
          webUrl: project.web_url as string,
          description: (project.description as string) || null,
          visibility: project.visibility as string,
          lastActivityAt: (project.last_activity_at as string) || null,
          stars: (project.star_count as number) || 0,
          forks: (project.forks_count as number) || 0,
          defaultBranch: (project.default_branch as string) || null,
          private: project.visibility === "private",
        })
      );

      return { success: true, data: { projects: formattedProjects } };
    } catch (error: any) {
      console.error("Error fetching GitLab projects:", error);
      return { success: false, error: error?.message || "Failed to fetch projects" };
    }
  },

  // Trello
  async getTrelloBoards(connectionId: string): Promise<ServiceResponse<{ boards: TrelloBoard[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const { apiKey, token } = result.secrets;

      if (!apiKey || !token) {
        return { success: false, error: "Trello API key and token are required" };
      }

      const authParams = `key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;
      const response = await fetch(
        `https://api.trello.com/1/members/me/boards?${authParams}&fields=id,name,shortLink,shortUrl,closed,desc,prefs,organization&filter=open`,
        { headers: { Accept: "application/json" } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Trello API error (${response.status}):`, errorText);
        return { success: false, error: `Trello API error: ${response.status}` };
      }

      const data: any = await response.json();
      const formattedBoards: TrelloBoard[] = (data || [])
        .filter((board: Record<string, unknown>) => !board.closed)
        .map((board: Record<string, unknown>) => ({
          id: board.id as string,
          name: board.name as string,
          shortLink: board.shortLink as string,
          shortUrl: board.shortUrl as string,
          desc: (board.desc as string) || "",
          closed: board.closed as boolean,
          organizationName: (board.organization as Record<string, unknown>)?.displayName as string || null,
          url: board.shortUrl as string,
        }));

      return { success: true, data: { boards: formattedBoards } };
    } catch (error: any) {
      console.error("Error fetching Trello boards:", error);
      return { success: false, error: error?.message || "Failed to fetch boards" };
    }
  },

  // Sentry
  async getSentryProjects(connectionId: string): Promise<ServiceResponse<{ projects: SentryProject[] }>> {
    try {
      if (!connectionId) return { success: false, error: "connectionId is required" };

      const result = await getConnectionAndSecrets(connectionId);
      if (!result.ok) return { success: false, error: result.error };

      const metadata = result.connection.metadata ? JSON.parse(result.connection.metadata) : {};
      const organization = metadata.organization as string;

      if (!organization) {
        return { success: false, error: "Sentry organization slug is required" };
      }

      const response = await fetch(
        `https://sentry.io/api/0/organizations/${encodeURIComponent(organization)}/projects/?per_page=100`,
        { headers: { Authorization: `Bearer ${result.secrets.token}`, Accept: "application/json" } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Sentry API error (${response.status}):`, errorText);
        return { success: false, error: `Sentry API error: ${response.status}` };
      }

      const data: any = await response.json();
      const formattedProjects: SentryProject[] = (data || []).map(
        (project: Record<string, unknown>) => ({
          id: String(project.id),
          slug: project.slug as string,
          name: project.name as string,
          platform: (project.platform as string) || null,
          dateCreated: (project.dateCreated as string) || "",
          status: (project.status as string) || "active",
          organization,
        })
      );

      return { success: true, data: { projects: formattedProjects } };
    } catch (error: any) {
      console.error("Error fetching Sentry projects:", error);
      return { success: false, error: error?.message || "Failed to fetch Sentry projects" };
    }
  },

  // Save resources
  async saveResources(
    payload: SaveResourcesPayload
  ): Promise<ServiceResponse<{ message: string; count: number }>> {
    try {
      const { provider, connectionId, resources } = payload;

      if (!provider || !connectionId) {
        return { success: false, error: "Provider and connectionId are required" };
      }

      const mapper = RESOURCE_MAPPERS[provider];
      if (!mapper) return { success: false, error: `Unsupported provider: ${provider}` };

      if (!resources?.length) return { success: false, error: "Resources are required" };

      for (const resource of resources) {
        await upsertConnectionResource({ connectionId, ...mapper(resource) });
      }

      return {
        success: true,
        data: { message: `${resources.length} resource(s) saved successfully`, count: resources.length },
      };
    } catch (error) {
      console.error("Error saving resources:", error);
      return { success: false, error: "Failed to save resources" };
    }
  },

  // Remove resource
  async removeResource(resourceId: string): Promise<ServiceResponse<{ message: string }>> {
    try {
      if (!resourceId) return { success: false, error: "Resource ID is required" };

      const decodedResourceId = decodeURIComponent(resourceId);
      const rows = await connectionsRepo.deleteResource(decodedResourceId);

      if (rows.length === 0) return { success: false, error: "Resource not found" };

      return { success: true, data: { message: "Resource removed successfully" } };
    } catch (error) {
      console.error("Error removing resource:", error);
      return { success: false, error: "Failed to remove resource" };
    }
  },

  // Get connection by provider
  async getByProvider(provider: string): Promise<
    ServiceResponse<{
      connection: {
        id: string;
        provider: string;
        displayName: string | null;
        status: string;
        metadata: Record<string, unknown>;
      };
    }>
  > {
    try {
      if (!provider) return { success: false, error: "Provider is required" };

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) return { success: false, error: `${provider} connection not found` };

      return {
        success: true,
        data: {
          connection: {
            id: connection.id,
            provider: connection.provider,
            displayName: connection.displayName,
            status: connection.status,
            metadata: parseConnectionMetadata(connection.metadata),
          },
        },
      };
    } catch (error) {
      console.error("Error fetching connection:", error);
      return { success: false, error: "Failed to fetch connection" };
    }
  },

  // Get selected resources
  async getSelectedResources(provider: string): Promise<ServiceResponse<unknown>> {
    try {
      if (!provider) return { success: false, error: "Provider is required" };

      const config = SELECTED_RESOURCE_CONFIGS[provider];
      if (!config) return { success: false, error: `Unsupported provider: ${provider}` };

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) return { success: false, error: `${provider} connection not found` };

      const resources = await connectionsRepo.findResourcesByConnectionAndKind(connection.id, config.kind, true);

      return {
        success: true,
        data: { [config.responseKey]: resources.map(config.formatItem), connectionId: connection.id },
      };
    } catch (error) {
      console.error("Error fetching selected resources:", error);
      return { success: false, error: "Failed to fetch selected resources" };
    }
  },

  // Delete resource
  async deleteResource(resourceId: string): Promise<ServiceResponse<void>> {
    try {
      if (!resourceId) return { success: false, error: "Resource ID is required" };

      await connectionsRepo.deleteResource(resourceId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error deleting resource:", error);
      return { success: false, error: "Failed to delete resource" };
    }
  },

  // Revoke connection
  async revoke(provider: string): Promise<ServiceResponse<void>> {
    try {
      if (!provider) return { success: false, error: "Provider is required" };

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) return { success: false, error: `${provider} connection not found` };

      await connectionsRepo.updateStatus(connection.id, "revoked", connection.metadata || "{}");
      await connectionsRepo.markTokensNotCurrent(connection.id);
      await connectionsRepo.deleteEntitiesByConnectionId(connection.id);
      await connectionsRepo.deleteResourcesByConnectionId(connection.id);
      await connectionsRepo.updateAppState(provider, false, null);

      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error revoking connection:", error);
      return { success: false, error: "Failed to revoke connection" };
    }
  },
};
