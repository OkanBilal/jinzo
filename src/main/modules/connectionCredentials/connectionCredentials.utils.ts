import crypto from "crypto";
import { safeStorage } from "electron";
import type { ParsedCredentials } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// Encryption Helpers
// ─────────────────────────────────────────────────────────────
function encryptToken(token: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token);
  }
  return Buffer.from(token, "utf-8");
}

function decryptToken(buffer: Buffer): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer);
    } catch {
      return buffer.toString("utf-8");
    }
  }
  return buffer.toString("utf-8");
}

/**
 * Encrypt a secrets map as a single JSON blob.
 * All provider secrets (tokens, API keys, etc.) are stored together.
 */
export function encryptSecrets(secrets: Record<string, string>): Buffer {
  return encryptToken(JSON.stringify(secrets));
}

/**
 * Decrypt a secrets blob back into a key-value map.
 */
export function decryptSecrets(buffer: Buffer): Record<string, string> {
  const raw = decryptToken(buffer);
  return JSON.parse(raw);
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
// Provider Secret Fields Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Defines which credential fields are secrets for each provider.
 * These get encrypted together as a JSON blob in accessTokenEnc.
 */
const PROVIDER_SECRET_FIELDS: Record<string, { required: string[]; optional?: string[] }> = {
  github:  { required: ["token"] },
  linear:  { required: ["apiKey"] },
  jira:    { required: ["apiToken"] },
  gitlab:  { required: ["token"] },
  asana:   { required: ["accessToken"] },
  trello:  { required: ["token", "apiKey"] },
  sentry:  { required: ["token"] },
};

/**
 * Parse and validate provider credentials.
 * Extracts secret fields based on PROVIDER_SECRET_FIELDS config.
 * Returns a secrets map to be encrypted as a JSON blob.
 */
export function parseProviderCredentials(
  provider: string,
  credentials: Record<string, unknown>
):
  | { success: true; data: ParsedCredentials }
  | { success: false; error: string } {

  const config = PROVIDER_SECRET_FIELDS[provider];
  if (!config) {
    return { success: false, error: `Unsupported provider: ${provider}` };
  }

  const secrets: Record<string, string> = {};
  const allValues: string[] = [];

  for (const field of config.required) {
    const value = credentials[field];
    if (!value || typeof value !== "string") {
      return { success: false, error: `${field} is required` };
    }
    secrets[field] = value;
    allValues.push(value);
  }

  if (config.optional) {
    for (const field of config.optional) {
      const value = credentials[field];
      if (value && typeof value === "string") {
        secrets[field] = value;
        allValues.push(value);
      }
    }
  }

  return {
    success: true,
    data: {
      secrets,
      tokensForHash: allValues,
    },
  };
}
