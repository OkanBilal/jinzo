import crypto from "crypto";
import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { connections, connectionTokens, appStates } from "../db/schema";

function encryptToken(token: string): Buffer {
  // TODO: Implement proper encryption here
  return Buffer.from(token, "utf-8");
}

/**
 * Register all IPC handlers for connection credentials operations
 */
export function registerConnectionCredentialsHandlers() {
  // Save connection credentials
  ipcMain.handle("connections:saveCredentials", async (_, payload: {
    provider: string;
    connectionId: string;
    [key: string]: any;
  }) => {
    try {
      const db = getDb();
      const { provider, connectionId, ...credentials } = payload;

      console.log("[saveCredentials] Received payload:", { provider, connectionId, hasCredentials: Object.keys(credentials).length > 0 });

      if (!provider || !connectionId) {
        console.error("[saveCredentials] Missing required fields:", { provider, connectionId });
        return { success: false, error: "Provider and connectionId are required" };
      }

      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      let tokensForHash: string[] = [];

      switch (provider) {
        case "github":
        case "raindrop":
          if (!credentials.token) {
            return { success: false, error: "Token is required" };
          }
          accessToken = credentials.token;
          tokensForHash = [credentials.token];
          break;

        case "podcast":
          if (!credentials.apiKey || !credentials.userId) {
            return { success: false, error: "API Key and User ID are required" };
          }
          accessToken = credentials.apiKey;
          refreshToken = credentials.userId;
          tokensForHash = [credentials.apiKey, credentials.userId];
          break;

        case "apple-music":
          if (!credentials.developerToken || !credentials.userToken) {
            return { success: false, error: "Developer Token and User Token are required" };
          }
          accessToken = credentials.developerToken;
          refreshToken = credentials.userToken;
          tokensForHash = [credentials.developerToken, credentials.userToken];
          break;

        case "spotify":
          if (!credentials.accessToken) {
            return { success: false, error: "Access token is required" };
          }
          accessToken = credentials.accessToken;
          tokensForHash = [credentials.accessToken];
          break;

        default:
          return { success: false, error: `Unsupported provider: ${provider}` };
      }

      const connection = await db
        .select()
        .from(connections)
        .where(eq(connections.id, connectionId))
        .get();

      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      await db
        .update(connectionTokens)
        .set({ isCurrent: false })
        .where(eq(connectionTokens.connectionId, connectionId))
        .run();

      const tokenHash = Buffer.from(
        crypto.createHash("sha256").update(tokensForHash.join(":")).digest()
      );

      const encryptedAccessToken = accessToken
        ? encryptToken(accessToken)
        : Buffer.from("");

      await db.insert(connectionTokens).values({
        connectionId,
        accessTokenEnc: encryptedAccessToken,
        refreshTokenEnc: refreshToken ? encryptToken(refreshToken) : null,
        tokenType: "bearer",
        expiresAt: null,
        tokenHash,
        keyVersion: 1,
        isCurrent: true,
      });

      const currentMetadata =
        typeof connection.metadata === "string"
          ? JSON.parse(connection.metadata)
          : connection.metadata || {};

      await db
        .update(connections)
        .set({
          status: "active",
          metadata: JSON.stringify({
            ...currentMetadata,
            lastCredentialUpdate: new Date().toISOString(),
          }),
          updatedAt: new Date(),
        })
        .where(eq(connections.id, connectionId))
        .run();

      await db
        .update(appStates)
        .set({
          isConnected: true,
          connectionId,
          updatedAt: new Date(),
        })
        .where(eq(appStates.id, provider))
        .run();

      return {
        success: true,
        data: {
          message: "Credentials saved successfully",
        },
      };
    } catch (error) {
      console.error("Error saving credentials:", error);
      return { success: false, error: "Failed to save credentials" };
    }
  });

  // Check if credentials exist for a connection
  ipcMain.handle("connections:checkCredentials", async (_, provider: string) => {
    try {
      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      const db = getDb();
      const connection = await db.query.connections.findFirst({
        where: eq(connections.provider, provider),
      });

      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const tokens = await db.query.connectionTokens.findMany({
        where: eq(connectionTokens.connectionId, connection.id),
      });

      const hasCredentials = tokens && tokens.length > 0;

      return {
        success: true,
        data: {
          hasCredentials,
          status: connection.status,
          connectionId: connection.id,
        },
      };
    } catch (error) {
      console.error("Error checking credentials:", error);
      return { success: false, error: "Failed to check credentials" };
    }
  });
}
