import { connectionCredentialsRepo } from "./connectionCredentials.repo";
import {
  encryptSecrets,
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
// Non-secret metadata fields per provider
// ─────────────────────────────────────────────────────────────
const PROVIDER_METADATA_FIELDS: Record<string, string[]> = {
  jira: ["domain", "email"],
  gitlab: ["domain"],
  sentry: ["organization"],
};

const PROVIDER_METADATA_DEFAULTS: Record<string, Record<string, string>> = {
  gitlab: { domain: "gitlab.com" },
};

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

      const { secrets, tokensForHash } = parseResult.data;

      const connection = await connectionCredentialsRepo.findConnectionById(connectionId);
      if (!connection) {
        return { success: false, error: "Connection not found" };
      }

      // Encrypt all secrets as a single JSON blob
      const tokenHash = createTokenHash(tokensForHash);
      const encryptedSecrets = encryptSecrets(secrets);

      // Atomically rotate: mark existing tokens not current + insert new one
      connectionCredentialsRepo.rotateToken({
        connectionId,
        accessTokenEnc: encryptedSecrets,
        refreshTokenEnc: null,
        tokenType: "bearer",
        expiresAt: null,
        tokenHash,
        keyVersion: 1,
      });

      // Update connection status and metadata (non-secret fields only)
      const currentMetadata = parseConnectionMetadata(connection.metadata);
      const updatedMetadata: Record<string, unknown> = {
        ...currentMetadata,
        lastCredentialUpdate: new Date().toISOString(),
      };

      // Extract non-secret metadata fields (domain, email, etc.)
      const metadataFields = PROVIDER_METADATA_FIELDS[provider];
      if (metadataFields) {
        const defaults = PROVIDER_METADATA_DEFAULTS[provider] || {};
        for (const field of metadataFields) {
          const value = (payload as Record<string, unknown>)[field];
          updatedMetadata[field] = value || defaults[field] || updatedMetadata[field];
        }
      }

      await connectionCredentialsRepo.updateConnectionStatus(
        connectionId,
        "active",
        JSON.stringify(updatedMetadata)
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
