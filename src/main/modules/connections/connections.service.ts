import { Octokit } from "@octokit/rest";
import { LinearClient } from "@linear/sdk";
import { connectionsRepo } from "./connections.repo";
import {
  decryptToken,
  formatSourceName,
  parseConnectionMetadata,
  parseResourceMetadata,
} from "./connections.utils";
import type {
  GithubRepo,
  RaindropCollection,
  LinearTeam,
  JiraProject,
  HackerNewsTogglePayload,
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

  // Raindrop
  async getRaindropCollections(
    connectionId: string
  ): Promise<ServiceResponse<{ collections: RaindropCollection[] }>> {
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

      const raindropToken = decryptToken(token.accessTokenEnc as Buffer);

      const response = await fetch("https://api.raindrop.io/rest/v1/collections", {
        headers: { Authorization: `Bearer ${raindropToken}` },
      });

      if (!response.ok) {
        throw new Error(`Raindrop API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.items || !Array.isArray(data.items)) {
        return { success: false, error: "Invalid response from Raindrop API" };
      }

      const formattedCollections: RaindropCollection[] = data.items.map(
        (collection: Record<string, unknown>) => ({
          id: collection._id,
          title: collection.title,
          count: collection.count,
          public: collection.public,
          cover: collection.cover || null,
          color: collection.color || null,
          created: collection.created,
          lastUpdate: collection.lastUpdate,
        })
      );

      return { success: true, data: { collections: formattedCollections } };
    } catch (error) {
      console.error("Error fetching Raindrop collections:", error);
      return { success: false, error: "Failed to fetch collections" };
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

  // HackerNews
  async getHackerNewsStatus(): Promise<ServiceResponse<{
    enabled: boolean;
    username: string | null;
    settings: { topStories: boolean; userSubmissions: boolean; userComments: boolean };
    connectionId: string;
  }>> {
    try {
      const connection = await connectionsRepo.findByProvider("hackernews");
      if (!connection) {
        return { success: false, error: "HackerNews connection not found" };
      }

      const metadata = parseConnectionMetadata(connection.metadata);
      const enabled = connection.status === "active";

      const resources = await connectionsRepo.findSelectedResourcesByConnection(connection.id);

      const settings = {
        topStories: resources.some((r) => r.kind === "hn_top_stories"),
        userSubmissions: resources.some((r) => r.kind === "hn_user_submissions"),
        userComments: resources.some((r) => r.kind === "hn_user_comments"),
      };

      return {
        success: true,
        data: {
          enabled,
          username: (metadata.username as string) || null,
          settings,
          connectionId: connection.id,
        },
      };
    } catch (error) {
      console.error("Error fetching HackerNews status:", error);
      return { success: false, error: "Failed to fetch status" };
    }
  },

  async toggleHackerNews(
    payload: HackerNewsTogglePayload
  ): Promise<ServiceResponse<{ connectionId: string; message: string }>> {
    try {
      const { enabled, username, topStories, userSubmissions, userComments } = payload;

      const connection = await connectionsRepo.findByProvider("hackernews");
      if (!connection) {
        return { success: false, error: "HackerNews connection not found" };
      }

      await connectionsRepo.updateStatus(
        connection.id,
        enabled ? "active" : "disabled",
        JSON.stringify({ username: username || null, updatedAt: new Date().toISOString() })
      );

      await connectionsRepo.updateAppState("hackernews", enabled, enabled ? connection.id : null);

      await connectionsRepo.deleteResourcesByConnectionId(connection.id);

      if (enabled) {
        const resourcesToAdd: Array<{
          id: string;
          connectionId: string;
          externalId: string;
          kind: string;
          name: string;
          url: string;
          selected: boolean;
          metadata: null;
          lastSeenAt: Date;
          lastIngestAt: null;
        }> = [];

        if (topStories) {
          resourcesToAdd.push({
            id: `${connection.id}:top_stories`,
            connectionId: connection.id,
            externalId: "top_stories",
            kind: "hn_top_stories",
            name: "Top Stories",
            url: "https://hacker-news.firebaseio.com/v0/topstories.json",
            selected: true,
            metadata: null,
            lastSeenAt: new Date(),
            lastIngestAt: null,
          });
        }

        if (userSubmissions && username) {
          resourcesToAdd.push({
            id: `${connection.id}:user_submissions`,
            connectionId: connection.id,
            externalId: "user_submissions",
            kind: "hn_user_submissions",
            name: `${username}'s Submissions`,
            url: `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
            selected: true,
            metadata: null,
            lastSeenAt: new Date(),
            lastIngestAt: null,
          });
        }

        if (userComments && username) {
          resourcesToAdd.push({
            id: `${connection.id}:user_comments`,
            connectionId: connection.id,
            externalId: "user_comments",
            kind: "hn_user_comments",
            name: `${username}'s Comments`,
            url: `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
            selected: true,
            metadata: null,
            lastSeenAt: new Date(),
            lastIngestAt: null,
          });
        }

        await connectionsRepo.insertResources(resourcesToAdd);
      }

      return {
        success: true,
        data: {
          connectionId: connection.id,
          message: enabled
            ? "HackerNews enabled successfully"
            : "HackerNews disabled successfully",
        },
      };
    } catch (error) {
      console.error("Error toggling HackerNews:", error);
      return { success: false, error: "Failed to toggle HackerNews" };
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

      if (!resources && !sources && provider !== "apple-music") {
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

        case "raindrop": {
          const selectedCollections = (resources || []) as RaindropCollection[];
          for (const collection of selectedCollections) {
            const resourceId = `${connectionId}:${collection.id}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              String(collection.id)
            );

            const metadata = JSON.stringify({
              title: collection.title,
              count: collection.count,
              public: collection.public,
              cover: collection.cover,
              color: collection.color,
              created: collection.created,
              lastUpdate: collection.lastUpdate,
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
                externalId: String(collection.id),
                kind: "raindrop_collection",
                name: collection.title,
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

        case "podcast": {
          const podcasts = (resources || []) as Array<{
            name: string;
            uuid: string;
            imageUrl?: string;
            description?: string;
          }>;
          for (const podcast of podcasts) {
            const resourceId = `${connectionId}:${podcast.name}`;
            const existing = await connectionsRepo.findResourceByExternalId(
              connectionId,
              podcast.name
            );

            const metadata = JSON.stringify({
              name: podcast.name,
              uuid: podcast.uuid,
              imageUrl: podcast.imageUrl,
              description: podcast.description,
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
                externalId: podcast.name,
                kind: "taddy_podcast",
                name: podcast.name,
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

        case "apple-music":
        case "spotify": {
          const sourcesArray = (sources || resources || []) as string[];

          if (!Array.isArray(sourcesArray) || sourcesArray.length === 0) {
            return { success: false, error: "At least one source must be selected" };
          }

          const kind = provider === "apple-music" ? "apple_music_source" : "spotify_source";

          for (const source of sourcesArray) {
            const resourceId = `${connectionId}:${source}`;
            const existing = await connectionsRepo.findResourceByExternalId(connectionId, source);

            const now = new Date().toISOString();
            const existingMetadata = existing?.metadata
              ? JSON.parse(existing.metadata)
              : null;

            const metadata = JSON.stringify({
              sourceType: source,
              addedAt: existingMetadata?.addedAt || now,
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
                externalId: source,
                kind,
                name: formatSourceName(source),
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

        case "rss": {
          const feeds = (resources || []) as Array<{ name: string; url: string }>;

          for (const feed of feeds) {
            const resourceId = `${connectionId}:${feed.url}`;
            const existing = await connectionsRepo.findResourceByExternalId(connectionId, feed.url);

            if (existing) {
              await connectionsRepo.updateResource(existing.id, {
                selected: true,
                lastSeenAt: new Date(),
                name: feed.name,
                url: feed.url,
                metadata: null,
              });
            } else {
              await connectionsRepo.insertResource({
                id: resourceId,
                connectionId,
                externalId: feed.url,
                kind: "rss_feed",
                name: feed.name,
                url: feed.url,
                selected: true,
                metadata: null,
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

        case "raindrop":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "raindrop_collection",
            true
          );
          responseData = {
            collections: resources.map((r) => ({
              id: r.id,
              externalId: r.externalId,
              name: r.name || "Untitled Collection",
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "podcast":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "taddy_podcast",
            true
          );
          responseData = {
            podcasts: resources.map((r) => ({
              id: r.id,
              name: r.name || "Unknown Podcast",
              metadata: parseResourceMetadata(r.metadata),
            })),
            connectionId: connection.id,
          };
          break;

        case "apple-music":
        case "spotify":
          resources = await connectionsRepo.findResourcesByConnectionId(connection.id);
          responseData = {
            repos: resources.map((r) => ({
              id: r.id,
              source: r.externalId,
              name: r.name,
              metadata: r.metadata,
            })),
            connectionId: connection.id,
          };
          break;

        case "rss":
          resources = await connectionsRepo.findResourcesByConnectionAndKind(
            connection.id,
            "rss_feed",
            true
          );
          responseData = {
            feeds: resources.map((r) => ({
              id: r.id,
              name: r.name || "Untitled Feed",
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

  // RSS status
  async getRssStatus(): Promise<
    ServiceResponse<{
      enabled: boolean;
      connectionId: string | null;
      feeds: Array<{ id: string; name: string; metadata: string | null }>;
    }>
  > {
    try {
      const appState = await connectionsRepo.findAppState("rss");

      if (!appState || !appState.isConnected || !appState.connectionId) {
        return {
          success: true,
          data: { enabled: false, connectionId: null, feeds: [] },
        };
      }

      const feeds = await connectionsRepo.findResourcesByConnectionId(appState.connectionId);

      return {
        success: true,
        data: {
          enabled: true,
          connectionId: appState.connectionId,
          feeds: feeds.map((feed) => ({
            id: feed.id,
            name: feed.name || "Untitled Feed",
            metadata: feed.metadata,
          })),
        },
      };
    } catch (error) {
      console.error("Error fetching RSS status:", error);
      return { success: false, error: "Failed to fetch RSS status" };
    }
  },

  // Toggle RSS
  async toggleRss(
    enabled: boolean
  ): Promise<ServiceResponse<{ connectionId: string; message?: string }>> {
    try {
      let connection = await connectionsRepo.findByProvider("rss");

      if (!connection && enabled) {
        connection = await connectionsRepo.insert({
          id: `conn_rss_${Date.now()}`,
          provider: "rss",
          type: "rss",
          status: "active",
          metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
        });

        await connectionsRepo.upsertAppState("rss", true, connection.id);

        return { success: true, data: { connectionId: connection.id } };
      }

      if (!connection) {
        return { success: false, error: "RSS connection not found" };
      }

      await connectionsRepo.updateStatus(
        connection.id,
        enabled ? "active" : "disabled",
        JSON.stringify({ updatedAt: new Date().toISOString() })
      );

      await connectionsRepo.updateAppState("rss", enabled, enabled ? connection.id : null);

      if (!enabled) {
        await connectionsRepo.deleteResourcesByConnectionId(connection.id);
      }

      return {
        success: true,
        data: {
          connectionId: connection.id,
          message: enabled ? "RSS enabled successfully" : "RSS disabled successfully",
        },
      };
    } catch (error) {
      console.error("Error toggling RSS:", error);
      return { success: false, error: "Failed to toggle RSS" };
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
      await connectionsRepo.deleteResourcesByConnectionId(connection.id);
      await connectionsRepo.updateAppState(provider, false, null);

      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error revoking connection:", error);
      return { success: false, error: "Failed to revoke connection" };
    }
  },
};
