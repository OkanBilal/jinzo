import { ipcMain } from "electron";
import { Octokit } from "@octokit/rest";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/client";
import {
  connections,
  connectionTokens,
  connectionResources,
  appStates,
} from "../../db/schema";
import {
  decryptToken,
  formatSourceName,
  parseConnectionMetadata,
  parseResourceMetadata,
} from "./utils";
import type {
  GithubRepo,
  RaindropCollection,
  HackerNewsTogglePayload,
  SaveResourcesPayload,
} from "./types";

export function registerConnectionsHandlers() {
  // Fetch GitHub repositories
  ipcMain.handle(
    "connections:getGithubRepos",
    async (_, connectionId: string) => {
      try {
        const db = getDb();

        if (!connectionId) {
          return { success: false, error: "connectionId is required" };
        }

        const connection = await db
          .select()
          .from(connections)
          .where(eq(connections.id, connectionId))
          .get();

        if (!connection) {
          return { success: false, error: "Connection not found" };
        }

        const token = await db
          .select()
          .from(connectionTokens)
          .where(
            and(
              eq(connectionTokens.connectionId, connectionId),
              eq(connectionTokens.isCurrent, true)
            )
          )
          .get();

        if (!token || !token.accessTokenEnc) {
          return { success: false, error: "Token not found" };
        }

        const decryptedToken = decryptToken(token.accessTokenEnc as Buffer);

        const octokit = new Octokit({
          auth: decryptedToken,
        });

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

        return {
          success: true,
          data: { repos: formattedRepos },
        };
      } catch (error) {
        console.error("Error fetching GitHub repos:", error);
        return { success: false, error: "Failed to fetch repositories" };
      }
    }
  );

  // Fetch Raindrop collections
  ipcMain.handle(
    "connections:getRaindropCollections",
    async (_, connectionId: string) => {
      try {
        const db = getDb();

        if (!connectionId) {
          return { success: false, error: "connectionId is required" };
        }

        const connection = await db
          .select()
          .from(connections)
          .where(eq(connections.id, connectionId))
          .get();

        if (!connection) {
          return { success: false, error: "Connection not found" };
        }

        const token = await db
          .select()
          .from(connectionTokens)
          .where(
            and(
              eq(connectionTokens.connectionId, connectionId),
              eq(connectionTokens.isCurrent, true)
            )
          )
          .get();

        if (!token || !token.accessTokenEnc) {
          return { success: false, error: "Token not found" };
        }

        const raindropToken = decryptToken(token.accessTokenEnc as Buffer);

        const response = await fetch(
          "https://api.raindrop.io/rest/v1/collections",
          {
            headers: {
              Authorization: `Bearer ${raindropToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Raindrop API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.items || !Array.isArray(data.items)) {
          return { success: false, error: "Invalid response from Raindrop API" };
        }

        const formattedCollections: RaindropCollection[] = data.items.map(
          (collection: any) => ({
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

        return {
          success: true,
          data: { collections: formattedCollections },
        };
      } catch (error) {
        console.error("Error fetching Raindrop collections:", error);
        return { success: false, error: "Failed to fetch collections" };
      }
    }
  );

  // Get HackerNews connection status
  ipcMain.handle("connections:getHackerNewsStatus", async () => {
    try {
      const db = getDb();

      const connection = await db
        .select()
        .from(connections)
        .where(eq(connections.provider, "hackernews"))
        .get();

      if (!connection) {
        return { success: false, error: "HackerNews connection not found" };
      }

      const metadata = parseConnectionMetadata(connection.metadata);
      const enabled = connection.status === "active";

      const resources = await db
        .select()
        .from(connectionResources)
        .where(
          and(
            eq(connectionResources.connectionId, connection.id),
            eq(connectionResources.selected, true)
          )
        )
        .all();

      const settings = {
        topStories: resources.some((r) => r.kind === "hn_top_stories"),
        userSubmissions: resources.some((r) => r.kind === "hn_user_submissions"),
        userComments: resources.some((r) => r.kind === "hn_user_comments"),
      };

      return {
        success: true,
        data: {
          enabled,
          username: metadata.username || null,
          settings,
          connectionId: connection.id,
        },
      };
    } catch (error) {
      console.error("Error fetching HackerNews status:", error);
      return { success: false, error: "Failed to fetch status" };
    }
  });

  // Enable or disable HackerNews
  ipcMain.handle(
    "connections:toggleHackerNews",
    async (_, payload: HackerNewsTogglePayload) => {
      try {
        const db = getDb();

        const { enabled, username, topStories, userSubmissions, userComments } =
          payload;

        const connection = await db
          .select()
          .from(connections)
          .where(eq(connections.provider, "hackernews"))
          .get();

        if (!connection) {
          return { success: false, error: "HackerNews connection not found" };
        }

        await db
          .update(connections)
          .set({
            status: enabled ? "active" : "disabled",
            metadata: JSON.stringify({
              username: username || null,
              updatedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          })
          .where(eq(connections.id, connection.id))
          .run();

        await db
          .update(appStates)
          .set({
            isConnected: enabled,
            connectionId: enabled ? connection.id : null,
            updatedAt: new Date(),
          })
          .where(eq(appStates.id, "hackernews"))
          .run();

        await db
          .delete(connectionResources)
          .where(eq(connectionResources.connectionId, connection.id))
          .run();

        if (enabled) {
          const resourcesToAdd = [];

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
              externalId: `user_submissions`,
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
              externalId: `user_comments`,
              kind: "hn_user_comments",
              name: `${username}'s Comments`,
              url: `https://hacker-news.firebaseio.com/v0/user/${username}.json`,
              selected: true,
              metadata: null,
              lastSeenAt: new Date(),
              lastIngestAt: null,
            });
          }

          if (resourcesToAdd.length > 0) {
            await db.insert(connectionResources).values(resourcesToAdd).run();
          }
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
    }
  );

  // Save connection resources
  ipcMain.handle(
    "connections:saveResources",
    async (_, payload: SaveResourcesPayload) => {
      try {
        const db = getDb();

        const { provider, connectionId, resources, sources } = payload;

        if (!provider || !connectionId) {
          return {
            success: false,
            error: "Provider and connectionId are required",
          };
        }

        if (!resources && !sources && provider !== "apple-music") {
          return { success: false, error: "Resources are required" };
        }

        let savedCount = 0;

        switch (provider) {
          case "github": {
            const selectedRepos = resources || [];

            for (const repo of selectedRepos) {
              const resourceId = `${connectionId}:${repo.fullName}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, repo.fullName)
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    metadata: JSON.stringify({
                      private: repo.private,
                      description: repo.description,
                      language: repo.language,
                      stars: repo.stars,
                      forks: repo.forks,
                      defaultBranch: repo.defaultBranch,
                      htmlUrl: repo.htmlUrl,
                      updatedAt: repo.updatedAt,
                    }),
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
                  id: resourceId,
                  connectionId,
                  externalId: repo.fullName,
                  kind: "github_repo",
                  name: repo.fullName,
                  url: repo.htmlUrl,
                  selected: true,
                  metadata: JSON.stringify({
                    private: repo.private,
                    description: repo.description,
                    language: repo.language,
                    stars: repo.stars,
                    forks: repo.forks,
                    defaultBranch: repo.defaultBranch,
                    htmlUrl: repo.htmlUrl,
                    updatedAt: repo.updatedAt,
                  }),
                  lastSeenAt: new Date(),
                  lastIngestAt: null,
                });
              }
              savedCount++;
            }
            break;
          }

          case "raindrop": {
            const selectedCollections = resources || [];

            for (const collection of selectedCollections) {
              const resourceId = `${connectionId}:${collection.id}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, String(collection.id))
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    metadata: JSON.stringify({
                      title: collection.title,
                      count: collection.count,
                      public: collection.public,
                      cover: collection.cover,
                      color: collection.color,
                      created: collection.created,
                      lastUpdate: collection.lastUpdate,
                    }),
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
                  id: resourceId,
                  connectionId,
                  externalId: String(collection.id),
                  kind: "raindrop_collection",
                  name: collection.title,
                  selected: true,
                  metadata: JSON.stringify({
                    title: collection.title,
                    count: collection.count,
                    public: collection.public,
                    cover: collection.cover,
                    color: collection.color,
                    created: collection.created,
                    lastUpdate: collection.lastUpdate,
                  }),
                  lastSeenAt: new Date(),
                  lastIngestAt: null,
                });
              }
              savedCount++;
            }
            break;
          }

          case "podcast": {
            const podcasts = resources || [];

            for (const podcast of podcasts) {
              const resourceId = `${connectionId}:${podcast.name}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, podcast.name)
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    metadata: JSON.stringify({
                      name: podcast.name,
                      uuid: podcast.uuid,
                      imageUrl: podcast.imageUrl,
                      description: podcast.description,
                    }),
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
                  id: resourceId,
                  connectionId,
                  externalId: podcast.name,
                  kind: "taddy_podcast",
                  name: podcast.name,
                  selected: true,
                  metadata: JSON.stringify({
                    name: podcast.name,
                    uuid: podcast.uuid,
                    imageUrl: podcast.imageUrl,
                    description: podcast.description,
                  }),
                  lastSeenAt: new Date(),
                  lastIngestAt: null,
                });
              }
              savedCount++;
            }
            break;
          }

          case "apple-music": {
            const sourcesArray = sources || resources || [];

            if (!Array.isArray(sourcesArray) || sourcesArray.length === 0) {
              return {
                success: false,
                error: "At least one source must be selected",
              };
            }

            for (const source of sourcesArray) {
              const resourceId = `${connectionId}:${source}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, source)
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    metadata: JSON.stringify({
                      sourceType: source,
                      addedAt: existing.metadata
                        ? JSON.parse(existing.metadata).addedAt
                        : new Date().toISOString(),
                    }),
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
                  id: resourceId,
                  connectionId,
                  externalId: source,
                  kind: "apple_music_source",
                  name: formatSourceName(source),
                  selected: true,
                  metadata: JSON.stringify({
                    sourceType: source,
                    addedAt: new Date().toISOString(),
                  }),
                  lastSeenAt: new Date(),
                  lastIngestAt: null,
                });
              }
              savedCount++;
            }
            break;
          }

          case "spotify": {
            const sourcesArray = sources || resources || [];

            if (!Array.isArray(sourcesArray) || sourcesArray.length === 0) {
              return {
                success: false,
                error: "At least one source must be selected",
              };
            }

            for (const source of sourcesArray) {
              const resourceId = `${connectionId}:${source}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, source)
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    metadata: JSON.stringify({
                      sourceType: source,
                      addedAt: existing.metadata
                        ? JSON.parse(existing.metadata).addedAt
                        : new Date().toISOString(),
                    }),
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
                  id: resourceId,
                  connectionId,
                  externalId: source,
                  kind: "spotify_source",
                  name: formatSourceName(source),
                  selected: true,
                  metadata: JSON.stringify({
                    sourceType: source,
                    addedAt: new Date().toISOString(),
                  }),
                  lastSeenAt: new Date(),
                  lastIngestAt: null,
                });
              }
              savedCount++;
            }
            break;
          }

          case "rss": {
            const feeds = resources || [];

            for (const feed of feeds) {
              const resourceId = `${connectionId}:${feed.url}`;

              const existing = await db
                .select()
                .from(connectionResources)
                .where(
                  and(
                    eq(connectionResources.connectionId, connectionId),
                    eq(connectionResources.externalId, feed.url)
                  )
                )
                .get();

              if (existing) {
                await db
                  .update(connectionResources)
                  .set({
                    selected: true,
                    lastSeenAt: new Date(),
                    name: feed.name,
                    url: feed.url,
                    metadata: null,
                  })
                  .where(eq(connectionResources.id, existing.id))
                  .run();
              } else {
                await db.insert(connectionResources).values({
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
    }
  );

  // Remove a connection resource by ID
  ipcMain.handle(
    "connections:removeResource",
    async (_, resourceId: string) => {
      try {
        const db = getDb();

        if (!resourceId) {
          return { success: false, error: "Resource ID is required" };
        }

        const decodedResourceId = decodeURIComponent(resourceId);

        const rows = await db
          .delete(connectionResources)
          .where(eq(connectionResources.id, decodedResourceId))
          .returning();

        if (rows.length === 0) {
          return { success: false, error: "Resource not found" };
        }

        return {
          success: true,
          data: { message: "Resource removed successfully" },
        };
      } catch (error) {
        console.error("Error removing resource:", error);
        return { success: false, error: "Failed to remove resource" };
      }
    }
  );

  // Get connection details by provider
  ipcMain.handle("connections:getByProvider", async (_, provider: string) => {
    try {
      const db = getDb();

      console.log(
        "[getByProvider] Fetching connection for provider:",
        provider
      );

      if (!provider) {
        console.error("[getByProvider] Provider is required");
        return { success: false, error: "Provider is required" };
      }

      const connection = await db
        .select()
        .from(connections)
        .where(eq(connections.provider, provider))
        .get();

      console.log(
        "[getByProvider] Found connection:",
        connection
          ? {
              id: connection.id,
              provider: connection.provider,
              status: connection.status,
            }
          : "NOT FOUND"
      );

      if (!connection) {
        console.error(
          "[getByProvider] Connection not found for provider:",
          provider
        );
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
      console.error("[getByProvider] Error fetching connection:", error);
      return { success: false, error: "Failed to fetch connection" };
    }
  });

  // Get selected resources for a provider
  ipcMain.handle(
    "connections:getSelectedResources",
    async (_, provider: string) => {
      try {
        const db = getDb();

        if (!provider) {
          return { success: false, error: "Provider is required" };
        }

        const connection = await db
          .select()
          .from(connections)
          .where(eq(connections.provider, provider))
          .get();

        if (!connection) {
          return { success: false, error: `${provider} connection not found` };
        }

        let resources;
        let responseData;

        switch (provider) {
          case "github":
            resources = await db
              .select()
              .from(connectionResources)
              .where(
                and(
                  eq(connectionResources.connectionId, connection.id),
                  eq(connectionResources.kind, "github_repo"),
                  eq(connectionResources.selected, true)
                )
              )
              .all();

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

          case "raindrop":
            resources = await db
              .select()
              .from(connectionResources)
              .where(
                and(
                  eq(connectionResources.connectionId, connection.id),
                  eq(connectionResources.kind, "raindrop_collection"),
                  eq(connectionResources.selected, true)
                )
              )
              .all();

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
            resources = await db
              .select()
              .from(connectionResources)
              .where(
                and(
                  eq(connectionResources.connectionId, connection.id),
                  eq(connectionResources.kind, "taddy_podcast"),
                  eq(connectionResources.selected, true)
                )
              )
              .all();

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
            resources = await db
              .select()
              .from(connectionResources)
              .where(eq(connectionResources.connectionId, connection.id))
              .all();

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

          case "spotify":
            resources = await db
              .select()
              .from(connectionResources)
              .where(eq(connectionResources.connectionId, connection.id))
              .all();

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
            resources = await db
              .select()
              .from(connectionResources)
              .where(
                and(
                  eq(connectionResources.connectionId, connection.id),
                  eq(connectionResources.kind, "rss_feed"),
                  eq(connectionResources.selected, true)
                )
              )
              .all();

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
    }
  );

  // Get RSS status
  ipcMain.handle("connections:getRssStatus", async () => {
    try {
      const db = getDb();

      const appState = await db
        .select()
        .from(appStates)
        .where(eq(appStates.id, "rss"))
        .get();

      if (!appState || !appState.isConnected || !appState.connectionId) {
        return {
          success: true,
          data: {
            enabled: false,
            connectionId: null,
            feeds: [],
          },
        };
      }

      const feeds = await db
        .select()
        .from(connectionResources)
        .where(eq(connectionResources.connectionId, appState.connectionId))
        .all();

      return {
        success: true,
        data: {
          enabled: true,
          connectionId: appState.connectionId,
          feeds: feeds.map((feed) => ({
            id: feed.id,
            name: feed.name,
            metadata: feed.metadata,
          })),
        },
      };
    } catch (error) {
      console.error("Error fetching RSS status:", error);
      return { success: false, error: "Failed to fetch RSS status" };
    }
  });

  // Toggle RSS (enable/disable)
  ipcMain.handle("connections:toggleRss", async (_, enabled: boolean) => {
    try {
      const db = getDb();

      let connection = await db
        .select()
        .from(connections)
        .where(eq(connections.provider, "rss"))
        .get();

      if (!connection && enabled) {
        const result = await db
          .insert(connections)
          .values({
            id: `conn_rss_${Date.now()}`,
            provider: "rss",
            type: "rss",
            status: "active",
            metadata: JSON.stringify({ createdAt: new Date().toISOString() }),
          })
          .returning()
          .get();

        connection = result;

        await db
          .insert(appStates)
          .values({
            id: "rss",
            isConnected: true,
            connectionId: connection.id,
          })
          .onConflictDoUpdate({
            target: appStates.id,
            set: {
              isConnected: true,
              connectionId: connection.id,
            },
          })
          .run();

        return {
          success: true,
          data: {
            connectionId: connection.id,
          },
        };
      }

      if (!connection) {
        return { success: false, error: "RSS connection not found" };
      }

      await db
        .update(connections)
        .set({
          status: enabled ? "active" : "disabled",
          metadata: JSON.stringify({
            updatedAt: new Date().toISOString(),
          }),
        })
        .where(eq(connections.id, connection.id))
        .run();

      await db
        .update(appStates)
        .set({
          isConnected: enabled,
          connectionId: enabled ? connection.id : null,
        })
        .where(eq(appStates.id, "rss"))
        .run();

      // If disabling, delete all resources
      if (!enabled) {
        await db
          .delete(connectionResources)
          .where(eq(connectionResources.connectionId, connection.id))
          .run();
      }

      return {
        success: true,
        data: {
          connectionId: connection.id,
          message: enabled
            ? "RSS enabled successfully"
            : "RSS disabled successfully",
        },
      };
    } catch (error) {
      console.error("Error toggling RSS:", error);
      return { success: false, error: "Failed to toggle RSS" };
    }
  });

  // Delete a resource
  ipcMain.handle(
    "connections:deleteResource",
    async (_, resourceId: string) => {
      try {
        const db = getDb();

        if (!resourceId) {
          return { success: false, error: "Resource ID is required" };
        }

        console.log("[deleteResource] Deleting resource:", resourceId);

        await db
          .delete(connectionResources)
          .where(eq(connectionResources.id, resourceId))
          .run();

        console.log("[deleteResource] Resource deleted successfully");

        return { success: true };
      } catch (error) {
        console.error("[deleteResource] Error:", error);
        return { success: false, error: "Failed to delete resource" };
      }
    }
  );

  // Revoke a connection
  ipcMain.handle("connections:revoke", async (_, provider: string) => {
    try {
      const db = getDb();

      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      console.log(
        "[revokeConnection] Revoking connection for provider:",
        provider
      );

      const connection = await db
        .select()
        .from(connections)
        .where(eq(connections.provider, provider))
        .get();

      if (!connection) {
        return { success: false, error: `${provider} connection not found` };
      }

      // Update connection status to revoked
      await db
        .update(connections)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(connections.id, connection.id))
        .run();

      // Mark all tokens as not current
      await db
        .update(connectionTokens)
        .set({ isCurrent: false })
        .where(eq(connectionTokens.connectionId, connection.id))
        .run();

      // Delete all resources
      await db
        .delete(connectionResources)
        .where(eq(connectionResources.connectionId, connection.id))
        .run();

      // Update app state
      await db
        .update(appStates)
        .set({
          isConnected: false,
          connectionId: null,
          updatedAt: new Date(),
        })
        .where(eq(appStates.id, provider))
        .run();

      console.log("[revokeConnection] Connection revoked successfully");

      return { success: true };
    } catch (error) {
      console.error("[revokeConnection] Error:", error);
      return { success: false, error: "Failed to revoke connection" };
    }
  });

  console.log("Connections handlers registered");
}

export function unregisterConnectionsHandlers() {
  ipcMain.removeHandler("connections:getGithubRepos");
  ipcMain.removeHandler("connections:getRaindropCollections");
  ipcMain.removeHandler("connections:getHackerNewsStatus");
  ipcMain.removeHandler("connections:toggleHackerNews");
  ipcMain.removeHandler("connections:saveResources");
  ipcMain.removeHandler("connections:removeResource");
  ipcMain.removeHandler("connections:getByProvider");
  ipcMain.removeHandler("connections:getSelectedResources");
  ipcMain.removeHandler("connections:getRssStatus");
  ipcMain.removeHandler("connections:toggleRss");
  ipcMain.removeHandler("connections:deleteResource");
  ipcMain.removeHandler("connections:revoke");
}
