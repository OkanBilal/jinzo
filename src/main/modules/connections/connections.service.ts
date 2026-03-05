import { Octokit } from "@octokit/rest";
import { LinearClient } from "@linear/sdk";
import { connectionsRepo } from "./connections.repo";
import {
  decryptToken,
  parseConnectionMetadata,
  parseResourceMetadata,
} from "./connections.utils";
import type {
  GithubRepo,
  LinearTeam,
  JiraProject,
  AsanaProject,
  GitlabProject,
  SaveResourcesPayload,
  ServiceResponse,
} from "./connections.dto";

// ─────────────────────────────────────────────────────────────
// Connections Service
// ─────────────────────────────────────────────────────────────
export const connectionsService = {
  // GitHub
  async getGithubRepos(connectionId: string): Promise<ServiceResponse<{ repos: GithubRepo[] }>> {
    try {
      if (!connectionId) {
        return { success: false, error: "connectionId is required" };
      }

      const connection = await connectionsRepo.findById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const token = await connectionsRepo.findCurrentToken(connectionId);
      if (!token || !token.accessTokenEnc) {
        return { success: false, error: "Token not found" };
      }

      const decryptedToken = decryptToken(token.accessTokenEnc as Buffer);
      const octokit = new Octokit({ auth: decryptedToken });

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
      if (!connectionId) {
        return { success: false, error: "connectionId is required" };
      }

      const connection = await connectionsRepo.findById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const token = await connectionsRepo.findCurrentToken(connectionId);
      if (!token || !token.accessTokenEnc) {
        return { success: false, error: "Token not found" };
      }

      const linearToken = decryptToken(token.accessTokenEnc as Buffer);
      const linearClient = new LinearClient({ apiKey: linearToken });

      const teamsConnection = await linearClient.teams();

      const formattedTeams: LinearTeam[] = teamsConnection.nodes.map((team) => ({
        id: team.id,
        key: team.key,
        name: team.name,
        description: team.description || null,
        icon: team.icon || null,
        color: team.color || null,
        issueCount: 0,
      }));

      return { success: true, data: { teams: formattedTeams } };
    } catch (error: any) {
      console.error("Error fetching Linear teams:", error);
      console.error("Linear error details:", {
        message: error?.message,
        type: error?.type,
        errors: error?.errors,
      });
      const errorMessage = error?.message || "Failed to fetch teams";
      return { success: false, error: errorMessage };
    }
  },

  // Jira
  async getJiraProjects(connectionId: string): Promise<ServiceResponse<{ projects: JiraProject[] }>> {
    try {
      if (!connectionId) {
        return { success: false, error: "connectionId is required" };
      }

      const connection = await connectionsRepo.findById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const token = await connectionsRepo.findCurrentToken(connectionId);
      if (!token || !token.accessTokenEnc) {
        return { success: false, error: "Token not found" };
      }

      const metadata = connection.metadata ? JSON.parse(connection.metadata) : {};
      const domain = metadata.domain as string;
      const email = metadata.email as string;

      if (!domain || !email) {
        return { success: false, error: "Jira domain and email are required in connection metadata" };
      }

      const jiraToken = decryptToken(token.accessTokenEnc as Buffer);

      // Build auth header and fetch projects
      const credentials = Buffer.from(`${email}:${jiraToken}`).toString("base64");
      const baseUrl = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/rest/api/3`;

      const response = await fetch(`${baseUrl}/project/search?maxResults=100`, {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Jira API error (${response.status}):`, errorText);
        return { success: false, error: `Jira API error: ${response.status}` };
      }

      const data = await response.json();

      const formattedProjects: JiraProject[] = (data.values || []).map(
        (project: Record<string, unknown>) => ({
          id: project.id as string,
          key: project.key as string,
          name: project.name as string,
          projectTypeKey: project.projectTypeKey as string,
          avatarUrl: (project.avatarUrls as Record<string, string>)?.["48x48"] || null,
        })
      );

      return { success: true, data: { projects: formattedProjects } };
    } catch (error: any) {
      console.error("Error fetching Jira projects:", error);
      const errorMessage = error?.message || "Failed to fetch projects";
      return { success: false, error: errorMessage };
    }
  },

  // Asana
  async getAsanaProjects(connectionId: string): Promise<ServiceResponse<{ projects: AsanaProject[] }>> {
    try {
      if (!connectionId) {
        return { success: false, error: "connectionId is required" };
      }

      const connection = await connectionsRepo.findById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const token = await connectionsRepo.findCurrentToken(connectionId);
      if (!token || !token.accessTokenEnc) {
        return { success: false, error: "Token not found" };
      }

      const asanaToken = decryptToken(token.accessTokenEnc as Buffer);
      const headers = {
        Authorization: `Bearer ${asanaToken}`,
        Accept: "application/json",
      };

      // First, fetch all workspaces
      const workspacesResponse = await fetch("https://app.asana.com/api/1.0/workspaces", {
        headers,
      });

      if (!workspacesResponse.ok) {
        const errorText = await workspacesResponse.text();
        console.error(`Asana API error fetching workspaces (${workspacesResponse.status}):`, errorText);
        return { success: false, error: `Asana API error: ${workspacesResponse.status}` };
      }

      const workspacesData = await workspacesResponse.json();
      const workspaces = workspacesData.data || [];

      if (workspaces.length === 0) {
        return { success: true, data: { projects: [] } };
      }

      // Fetch projects from each workspace
      const allProjects: AsanaProject[] = [];

      for (const workspace of workspaces) {
        const workspaceGid = workspace.gid as string;
        const workspaceName = workspace.name as string;

        const url = `https://app.asana.com/api/1.0/workspaces/${workspaceGid}/projects?opt_fields=gid,name,archived,color,team.gid,team.name&limit=100`;

        const response = await fetch(url, { headers });

        if (!response.ok) {
          console.error(`Asana API error fetching projects for workspace ${workspaceGid}:`, await response.text());
          continue; // Skip this workspace but continue with others
        }

        const data = await response.json();

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
            };
          });

        allProjects.push(...projects);
      }

      return { success: true, data: { projects: allProjects } };
    } catch (error: any) {
      console.error("Error fetching Asana projects:", error);
      const errorMessage = error?.message || "Failed to fetch projects";
      return { success: false, error: errorMessage };
    }
  },

  // GitLab
  async getGitlabProjects(connectionId: string): Promise<ServiceResponse<{ projects: GitlabProject[] }>> {
    try {
      if (!connectionId) {
        return { success: false, error: "connectionId is required" };
      }

      const connection = await connectionsRepo.findById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const token = await connectionsRepo.findCurrentToken(connectionId);
      if (!token || !token.accessTokenEnc) {
        return { success: false, error: "Token not found" };
      }

      const metadata = connection.metadata ? JSON.parse(connection.metadata) : {};
      const domain = (metadata.domain as string) || "gitlab.com";
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const baseUrl = `https://${cleanDomain}/api/v4`;

      const gitlabToken = decryptToken(token.accessTokenEnc as Buffer);

      const response = await fetch(
        `${baseUrl}/projects?membership=true&per_page=100&order_by=last_activity_at`,
        {
          headers: {
            "PRIVATE-TOKEN": gitlabToken,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GitLab API error (${response.status}):`, errorText);
        return { success: false, error: `GitLab API error: ${response.status}` };
      }

      const data = await response.json();

      const formattedProjects: GitlabProject[] = (data || []).map(
        (project: Record<string, unknown>) => ({
          id: project.id as number,
          name: project.name as string,
          pathWithNamespace: project.path_with_namespace as string,
          webUrl: project.web_url as string,
          description: (project.description as string) || null,
          visibility: project.visibility as string,
          lastActivityAt: (project.last_activity_at as string) || null,
        })
      );

      return { success: true, data: { projects: formattedProjects } };
    } catch (error: any) {
      console.error("Error fetching GitLab projects:", error);
      const errorMessage = error?.message || "Failed to fetch projects";
      return { success: false, error: errorMessage };
    }
  },

  // Save resources
  async saveResources(
    payload: SaveResourcesPayload
  ): Promise<ServiceResponse<{ message: string; count: number }>> {
    try {
      const { provider, connectionId, resources, sources } = payload;

      if (!provider || !connectionId) {
        return { success: false, error: "Provider and connectionId are required" };
      }

      if (!resources && !sources) {
        return { success: false, error: "Resources are required" };
      }

      let savedCount = 0;

      switch (provider) {
        case "github": {
          const selectedRepos = (resources || []) as GithubRepo[];
          for (const repo of selectedRepos) {
            const resourceId = `${connectionId}:${repo.fullName}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              repo.fullName
            );

            const metadata = JSON.stringify({
              private: repo.private,
              description: repo.description,
              language: repo.language,
              stars: repo.stars,
              forks: repo.forks,
              defaultBranch: repo.defaultBranch,
              htmlUrl: repo.htmlUrl,
              updatedAt: repo.updatedAt,
            });

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                metadata,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: repo.fullName,
                kind: "github_repo",
                name: repo.fullName,
                url: repo.htmlUrl,
                selected: true,
                metadata,
                lastSeenAt: new Date(),
                lastIngestAt: null,
              });
            }
            savedCount++;
          }
          break;
        }

        case "linear": {
          const selectedTeams = (resources || []) as LinearTeam[];
          for (const team of selectedTeams) {
            const resourceId = `${connectionId}:${team.key}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              team.key
            );

            const metadata = JSON.stringify({
              id: team.id,

              name: team.name,
              key: team.key,
              description: team.description,
              icon: team.icon,
              color: team.color,
              issueCount: team.issueCount,
            });

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                metadata,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: team.key,
                kind: "linear_team",
                name: team.name,
                selected: true,
                metadata,
                lastSeenAt: new Date(),
                lastIngestAt: null,
              });
            }
            savedCount++;
          }
          break;
        }

        case "jira": {
          const selectedProjects = (resources || []) as JiraProject[];
          for (const project of selectedProjects) {
            const resourceId = `${connectionId}:${project.key}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              project.key
            );

            const metadata = JSON.stringify({
              id: project.id,
              name: project.name,
              key: project.key,
              projectTypeKey: project.projectTypeKey,
              avatarUrl: project.avatarUrl,
            });

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                metadata,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: project.key,
                kind: "jira_project",
                name: project.name,
                selected: true,
                metadata,
                lastSeenAt: new Date(),
                lastIngestAt: null,
              });
            }
            savedCount++;
          }
          break;
        }

        case "asana": {
          const selectedAsanaProjects = (resources || []) as AsanaProject[];
          for (const project of selectedAsanaProjects) {
            const resourceId = `${connectionId}:${project.gid}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              project.gid
            );

            const metadata = JSON.stringify({
              gid: project.gid,
              name: project.name,
              color: project.color,
              workspaceGid: project.workspaceGid,
              workspaceName: project.workspaceName,
              teamGid: project.teamGid,
              teamName: project.teamName,
            });

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                metadata,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: project.gid,
                kind: "asana_project",
                name: project.name,
                selected: true,
                metadata,
                lastSeenAt: new Date(),
                lastIngestAt: null,
              });
            }
            savedCount++;
          }
          break;
        }

        case "gitlab": {
          const selectedGitlabProjects = (resources || []) as GitlabProject[];
          for (const project of selectedGitlabProjects) {
            const resourceId = `${connectionId}:${project.id}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              String(project.id)
            );

            const metadata = JSON.stringify({
              id: project.id,
              name: project.name,
              pathWithNamespace: project.pathWithNamespace,
              webUrl: project.webUrl,
              description: project.description,
              visibility: project.visibility,
              lastActivityAt: project.lastActivityAt,
            });

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                metadata,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: String(project.id),
                kind: "gitlab_project",
                name: project.pathWithNamespace,
                url: project.webUrl,
                selected: true,
                metadata,
                lastSeenAt: new Date(),
                lastIngestAt: null,
              });
            }
            savedCount++;
          }
          break;
        }

        default:
          return { success: false, error: `Unsupported provider: ${provider}` };
      }

      return {
        success: true,
        data: {
          message: `${savedCount} resource(s) saved successfully`,
          count: savedCount,
        },
      };
    } catch (error) {
      console.error("Error saving resources:", error);
      return { success: false, error: "Failed to save resources" };
    }
  },

  // Remove resource
  async removeResource(resourceId: string): Promise<ServiceResponse<{ message: string }>> {
    try {
      if (!resourceId) {
        return { success: false, error: "Resource ID is required" };
      }

      const decodedResourceId = decodeURIComponent(resourceId);
      const rows = await connectionsRepo.deleteResource(decodedResourceId);

      if (rows.length === 0) {
        return { success: false, error: "Resource not found" };
      }

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
      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) {
        return { success: false, error: `${provider} connection not found` };
      }

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
      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) {
        return { success: false, error: `${provider} connection not found` };
      }

      let resources;
      let responseData: unknown;

      switch (provider) {
        case "github":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "github_repo",
            true
          );
          responseData = {
            repos: resources.map((r) => ({
              id: r.id,
              fullName: r.externalId,
              name: r.name || r.externalId,
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "linear":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "linear_team",
            true
          );
          responseData = {
            teams: resources.map((r) => ({
              id: r.id,
              key: r.externalId,
              name: r.name || r.externalId,
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "jira":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "jira_project",
            true
          );
          responseData = {
            projects: resources.map((r) => ({
              id: r.id,
              key: r.externalId,
              name: r.name || r.externalId,
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "asana":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "asana_project",
            true
          );
          responseData = {
            projects: resources.map((r) => ({
              id: r.id,
              gid: r.externalId,
              name: r.name || r.externalId,
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "gitlab":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "gitlab_project",
            true
          );
          responseData = {
            projects: resources.map((r) => ({
              id: r.id,
              externalId: r.externalId,
              name: r.name || r.externalId,
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        default:
          return { success: false, error: `Unsupported provider: ${provider}` };
      }

      return { success: true, data: responseData };
    } catch (error) {
      console.error("Error fetching selected resources:", error);
      return { success: false, error: "Failed to fetch selected resources" };
    }
  },

  // Delete resource
  async deleteResource(resourceId: string): Promise<ServiceResponse<void>> {
    try {
      if (!resourceId) {
        return { success: false, error: "Resource ID is required" };
      }

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
      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      const connection = await connectionsRepo.findByProvider(provider);
      if (!connection) {
        return { success: false, error: `${provider} connection not found` };
      }

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
