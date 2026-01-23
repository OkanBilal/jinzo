import { connectionCredentialsRepo } from "./connectionCredentials.repo";
import {
  encryptToken,
  createTokenHash,
  parseProviderCredentials,
  parseConnectionMetadata,
} from "./connectionCredentials.utils";
import type {
  SaveCredentialsPayload,
  CredentialsCheckResult,
  SaveCredentialsResult,
  ServiceResponse,
} from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Connection Credentials Service
// ─────────────────────────────────────────────────────────────
export const connectionCredentialsService = {
  async saveCredentials(
    payload: SaveCredentialsPayload
  ): Promise<ServiceResponse<SaveCredentialsResult>> {
    try {
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

      const connection = await connectionCredentialsRepo.findConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      // Mark existing tokens as not current
      await connectionCredentialsRepo.markTokensNotCurrent(connectionId);

      const tokenHash = createTokenHash(tokensForHash);
      const encryptedAccessToken = accessToken
        ? encryptToken(accessToken)
        : Buffer.from("");

      // Insert new token
      await connectionCredentialsRepo.insertToken({
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
      await connectionCredentialsRepo.updateConnectionStatus(
        connectionId,
        "active",
        JSON.stringify({
          ...currentMetadata,
          lastCredentialUpdate: new Date().toISOString(),
        })
      );

      // Update app state
      await connectionCredentialsRepo.updateAppState(provider, connectionId, true);

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
  },

  async checkCredentials(
    provider: string
  ): Promise<ServiceResponse<CredentialsCheckResult>> {
    try {
      if (!provider) {
        return { success: false, error: "Provider is required" };
      }

      const connection = await connectionCredentialsRepo.findConnectionByProvider(provider);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      const tokens = await connectionCredentialsRepo.findTokensByConnectionId(connection.id);
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
  },
};
