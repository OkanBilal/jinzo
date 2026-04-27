import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  app: {
    getPath: () => "/tmp",
    getName: () => "mains",
    getVersion: () => "0.0.0",
  },
}));

import {
  encryptSecrets,
  decryptSecrets,
  createTokenHash,
  parseConnectionMetadata,
  parseProviderCredentials,
} from "./connectionCredentials.utils";

describe("connectionCredentials.utils", () => {
  // ─────────────────────────────────────────────────────────────
  // Encrypt / Decrypt
  // ─────────────────────────────────────────────────────────────
  describe("encryptSecrets / decryptSecrets", () => {
    it("round-trips a secrets map", () => {
      const secrets = { token: "gh_abc123", apiKey: "key-xyz" };
      const encrypted = encryptSecrets(secrets);
      expect(encrypted).toBeInstanceOf(Buffer);

      const decrypted = decryptSecrets(encrypted);
      expect(decrypted).toEqual(secrets);
    });

    it("handles single-field secrets", () => {
      const secrets = { token: "test-token" };
      const result = decryptSecrets(encryptSecrets(secrets));
      expect(result).toEqual(secrets);
    });

    it("handles empty secrets", () => {
      const secrets = {};
      const result = decryptSecrets(encryptSecrets(secrets));
      expect(result).toEqual(secrets);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Token Hash
  // ─────────────────────────────────────────────────────────────
  describe("createTokenHash", () => {
    it("returns a Buffer", () => {
      const hash = createTokenHash(["token1"]);
      expect(hash).toBeInstanceOf(Buffer);
      expect(hash.length).toBe(32); // SHA-256 = 32 bytes
    });

    it("produces deterministic output", () => {
      const hash1 = createTokenHash(["token1", "token2"]);
      const hash2 = createTokenHash(["token1", "token2"]);
      expect(hash1.equals(hash2)).toBe(true);
    });

    it("different tokens produce different hashes", () => {
      const hash1 = createTokenHash(["token1"]);
      const hash2 = createTokenHash(["token2"]);
      expect(hash1.equals(hash2)).toBe(false);
    });

    it("joins tokens with colon separator", () => {
      const combined = createTokenHash(["a", "b"]);
      const separate1 = createTokenHash(["a:b"]);
      // "a" + ":" + "b" == "a:b" so they should be equal
      expect(combined.equals(separate1)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // parseConnectionMetadata
  // ─────────────────────────────────────────────────────────────
  describe("parseConnectionMetadata", () => {
    it("returns empty object for null", () => {
      expect(parseConnectionMetadata(null)).toEqual({});
    });

    it("parses JSON string", () => {
      const result = parseConnectionMetadata('{"domain":"jira.example.com"}');
      expect(result).toEqual({ domain: "jira.example.com" });
    });

    it("returns object as-is", () => {
      const obj = { key: "value" };
      expect(parseConnectionMetadata(obj)).toBe(obj);
    });

    it("returns empty object for invalid JSON", () => {
      expect(parseConnectionMetadata("not-json")).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────
  // parseProviderCredentials
  // ─────────────────────────────────────────────────────────────
  describe("parseProviderCredentials", () => {
    it("parses github credentials", () => {
      const result = parseProviderCredentials("github", { token: "gh_abc" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ token: "gh_abc" });
        expect(result.data.tokensForHash).toEqual(["gh_abc"]);
      }
    });

    it("parses linear credentials", () => {
      const result = parseProviderCredentials("linear", { apiKey: "lin_123" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ apiKey: "lin_123" });
      }
    });

    it("parses jira credentials", () => {
      const result = parseProviderCredentials("jira", { apiToken: "jira-tok" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ apiToken: "jira-tok" });
      }
    });

    it("parses gitlab credentials", () => {
      const result = parseProviderCredentials("gitlab", { token: "glpat-xxx" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ token: "glpat-xxx" });
      }
    });

    it("parses asana credentials", () => {
      const result = parseProviderCredentials("asana", { accessToken: "asana-tok" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ accessToken: "asana-tok" });
      }
    });

    it("parses trello credentials (two required fields)", () => {
      const result = parseProviderCredentials("trello", {
        token: "trello-tok",
        apiKey: "trello-key",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.secrets).toEqual({ token: "trello-tok", apiKey: "trello-key" });
        expect(result.data.tokensForHash).toEqual(["trello-tok", "trello-key"]);
      }
    });

    it("fails for unsupported provider", () => {
      const result = parseProviderCredentials("unknown", { token: "x" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unsupported provider");
      }
    });

    it("fails when required field is missing", () => {
      const result = parseProviderCredentials("github", {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("token is required");
      }
    });

    it("fails when required field is not a string", () => {
      const result = parseProviderCredentials("github", { token: 123 });
      expect(result.success).toBe(false);
    });

    it("fails for trello when one of two required fields missing", () => {
      const result = parseProviderCredentials("trello", { token: "tok" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("apiKey is required");
      }
    });
  });
});
