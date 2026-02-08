import crypto from "crypto";
import type { ParsedCredentials } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Encryption Helpers
// ─────────────────────────────────────────────────────────────
export function encryptToken(token: string): Buffer {
  // TODO: Implement proper encryption here
  return Buffer.from(token, "utf-8");
}

export function createTokenHash(tokens: string[]): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(tokens.join(":")).digest()
  );
}

// ─────────────────────────────────────────────────────────────
// Metadata Parsing
// ─────────────────────────────────────────────────────────────
export function parseConnectionMetadata(
  metadata: string | object | null
): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Provider Credential Parsing
// ─────────────────────────────────────────────────────────────
export function parseProviderCredentials(
  provider: string,
  credentials: Record<string, unknown>
):
  | { success: true; data: ParsedCredentials }
  | { success: false; error: string } {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let tokensForHash: string[] = [];

  switch (provider) {
    case "github":
    case "raindrop":
      if (!credentials.token) {
        return { success: false, error: "Token is required" };
      }
      accessToken = credentials.token as string;
      tokensForHash = [credentials.token as string];
      break;

    case "linear":
      if (!credentials.apiKey) {
        return { success: false, error: "API Key is required" };
      }
      accessToken = credentials.apiKey as string;
      tokensForHash = [credentials.apiKey as string];
      break;

    case "podcast":
      if (!credentials.apiKey || !credentials.userId) {
        return {
          success: false,
          error: "API Key and User ID are required",
        };
      }
      accessToken = credentials.apiKey as string;
      refreshToken = credentials.userId as string;
      tokensForHash = [
        credentials.apiKey as string,
        credentials.userId as string,
      ];
      break;

    case "apple-music":
      if (!credentials.developerToken || !credentials.userToken) {
        return {
          success: false,
          error: "Developer Token and User Token are required",
        };
      }
      accessToken = credentials.developerToken as string;
      refreshToken = credentials.userToken as string;
      tokensForHash = [
        credentials.developerToken as string,
        credentials.userToken as string,
      ];
      break;

    case "spotify":
      if (!credentials.accessToken) {
        return { success: false, error: "Access token is required" };
      }
      accessToken = credentials.accessToken as string;
      tokensForHash = [credentials.accessToken as string];
      break;


    case "jira":
      // Jira requires apiToken, domain, and email
      // apiToken is stored as accessToken, domain and email stored in connection metadata
      if (!credentials.apiToken) {
        return { success: false, error: "API Token is required" };
      }
      accessToken = credentials.apiToken as string;
      tokensForHash = [credentials.apiToken as string];
      break;

    case "asana":
      // Asana uses a Personal Access Token (PAT)
      if (!credentials.accessToken) {
        return { success: false, error: "Access Token is required" };
      }
      accessToken = credentials.accessToken as string;
      tokensForHash = [credentials.accessToken as string];
      break;

    default:
      return { success: false, error: `Unsupported provider: ${provider}` };
  }

  return {
    success: true,
    data: { accessToken, refreshToken, tokensForHash },
  };
}
