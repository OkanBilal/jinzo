import crypto from "crypto";
import type { ParsedCredentials } from "./types";

export function encryptToken(token: string): Buffer {
  // TODO: Implement proper encryption here
  return Buffer.from(token, "utf-8");
}

export function createTokenHash(tokens: string[]): Buffer {
  return Buffer.from(
    crypto.createHash("sha256").update(tokens.join(":")).digest()
  );
}

export function parseProviderCredentials(
  provider: string,
  credentials: Record<string, any>
): { success: true; data: ParsedCredentials } | { success: false; error: string } {
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

  return {
    success: true,
    data: { accessToken, refreshToken, tokensForHash },
  };
}

export function parseConnectionMetadata(metadata: string | object | null): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata as Record<string, any>;
}
