import crypto from "crypto";
import os from "os";
import { safeStorage } from "electron";
import type { ParsedCredentials } from "./connectionCredentials.dto";

// ─────────────────────────────────────────────────────────────
// AES-256-GCM Fallback (when safeStorage is unavailable)
// ─────────────────────────────────────────────────────────────
const FALLBACK_SALT = Buffer.from("mains-credential-encryption-salt");
const FALLBACK_IV_LENGTH = 16;
const FALLBACK_AUTH_TAG_LENGTH = 16;

let _fallbackKey: Buffer | null = null;

function getFallbackKey(): Buffer {
  if (_fallbackKey) return _fallbackKey;
  const machineId = [os.hostname(), os.homedir(), os.userInfo().username].join(":");
  _fallbackKey = crypto.pbkdf2Sync(machineId, FALLBACK_SALT, 100_000, 32, "sha512");
  return _fallbackKey;
}

function fallbackEncrypt(plaintext: string): Buffer {
  const iv = crypto.randomBytes(FALLBACK_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getFallbackKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function fallbackDecrypt(buffer: Buffer): string {
  const iv = buffer.subarray(0, FALLBACK_IV_LENGTH);
  const authTag = buffer.subarray(FALLBACK_IV_LENGTH, FALLBACK_IV_LENGTH + FALLBACK_AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(FALLBACK_IV_LENGTH + FALLBACK_AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getFallbackKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf-8");
}

// ─────────────────────────────────────────────────────────────
// Encryption Helpers
// ─────────────────────────────────────────────────────────────
function encryptToken(token: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(token);
  }
  console.warn("[Credentials] safeStorage unavailable, using AES-256-GCM fallback");
  return fallbackEncrypt(token);
}

function decryptToken(buffer: Buffer): string {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer);
    } catch (err) {
      console.error("[Credentials] safeStorage decryption failed, attempting fallback:", err);
    }
  }
  try {
    return fallbackDecrypt(buffer);
  } catch (err) {
    console.error("[Credentials] Fallback decryption also failed:", err);
    throw new Error("Failed to decrypt credentials — data may be corrupted");
  }
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
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Credentials] Failed to parse decrypted secrets as JSON:", err);
    throw new Error("Decrypted credential data is not valid JSON — token may be corrupted");
  }
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
  socketdev: { required: ["apiToken"] },
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
