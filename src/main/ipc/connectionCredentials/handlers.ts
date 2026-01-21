import { ipcMain } from "electron";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { connections, connectionTokens, appStates } from "../../db/schema";
import {
  encryptToken,
  createTokenHash,
  parseProviderCredentials,
  parseConnectionMetadata,
} from "./utils";
import type { SaveCredentialsPayload } from "./types";

export function registerConnectionCredentialsHandlers() {
  // Save connection credentials
  ipcMain.handle(
    "connections:saveCredentials",
    async (_, payload: SaveCredentialsPayload) => {
      try {
        const db = getDb();
        const { provider, connectionId, ...credentials } = payload;

        console.log("[saveCredentials] Received payload:", {
          provider,
          connectionId,
          hasCredentials: Object.keys(credentials).length > 0,
        });

        if (!provider || !connectionId) {
          console.error("[saveCredentials] Missing required fields:", {
            provider,
            connectionId,
          });
          return {
            success: false,
            error: "Provider and connectionId are required",
          };
        }

        const parseResult = parseProviderCredentials(provider, credentials);
        if (!parseResult.success) {
          return { success: false, error: parseResult.error };
        }

        const { accessToken, refreshToken, tokensForHash } = parseResult.data;

        const connection = await db
          .select()
          .from(connections)
          .where(eq(connections.id, connectionId))
          .get();

        if (!connection) {
          return { success: false, error: "Connection not found" };
        }

        // Mark existing tokens as not current
        await db
          .update(connectionTokens)
          .set({ isCurrent: false })
          .where(eq(connectionTokens.connectionId, connectionId))
          .run();

        const tokenHash = createTokenHash(tokensForHash);
        const encryptedAccessToken = accessToken
          ? encryptToken(accessToken)
          : Buffer.from("");

        // Insert new token
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

        // Update connection status
        const currentMetadata = parseConnectionMetadata(connection.metadata);

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

        // Update app state
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
    }
  );

  // Check if credentials exist for a connection
  ipcMain.handle(
    "connections:checkCredentials",
    async (_, provider: string) => {
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
    }
  );

  console.log("Connection credentials handlers registered");
}

export function unregisterConnectionCredentialsHandlers() {
  ipcMain.removeHandler("connections:saveCredentials");
  ipcMain.removeHandler("connections:checkCredentials");
}
