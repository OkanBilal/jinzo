import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createConnection, createAppState } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

import { connectionCredentialsService } from "./connectionCredentials.service";

describe("connectionCredentialsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // saveCredentials
  // ─────────────────────────────────────────────────────────────
  describe("saveCredentials", () => {
    it("returns error when provider missing", async () => {
      const result = await connectionCredentialsService.saveCredentials({
        provider: "",
        connectionId: "c1",
        token: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider and connectionId are required");
    });

    it("returns error when connectionId missing", async () => {
      const result = await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "",
        token: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider and connectionId are required");
    });

    it("returns error for unsupported provider", async () => {
      createConnection(db, { id: "c1", provider: "unknown" });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "unknown",
        connectionId: "c1",
        token: "abc",
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported provider");
    });

    it("returns error when required secret field missing", async () => {
      createConnection(db, { id: "c1", provider: "github" });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "c1",
        // token is missing
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("token is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "nonexistent",
        token: "ghp_abc",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection not found");
    });

    it("saves github credentials successfully", async () => {
      createConnection(db, { id: "c1", provider: "github", status: "active", metadata: "{}" });
      createAppState(db, { id: "github", isConnected: false });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "c1",
        token: "ghp_test123",
      });
      expect(result.success).toBe(true);
      expect(result.data!.message).toContain("saved successfully");

      // Verify token was inserted
      const tokens = _sqlite.prepare("SELECT * FROM connection_tokens WHERE connection_id = 'c1'").all() as any[];
      expect(tokens).toHaveLength(1);
      expect(tokens[0].is_current).toBe(1);
    });

    it("saves linear credentials successfully", async () => {
      createConnection(db, { id: "c2", provider: "linear", status: "active", metadata: "{}" });
      createAppState(db, { id: "linear", isConnected: false });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "linear",
        connectionId: "c2",
        apiKey: "lin_api_test",
      });
      expect(result.success).toBe(true);
    });

    it("saves jira credentials with metadata fields", async () => {
      createConnection(db, { id: "c3", provider: "jira", status: "active", metadata: "{}" });
      createAppState(db, { id: "jira", isConnected: false });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "jira",
        connectionId: "c3",
        apiToken: "jira_token",
        domain: "mycompany.atlassian.net",
        email: "user@company.com",
      });
      expect(result.success).toBe(true);

      // Verify metadata was updated with domain and email
      const conn = _sqlite.prepare("SELECT * FROM connections WHERE id = 'c3'").get() as any;
      const metadata = JSON.parse(conn.metadata);
      expect(metadata.domain).toBe("mycompany.atlassian.net");
      expect(metadata.email).toBe("user@company.com");
    });

    it("marks old tokens as not current when saving new ones", async () => {
      createConnection(db, { id: "c1", provider: "github", status: "active", metadata: "{}" });
      createAppState(db, { id: "github", isConnected: false });

      // Save first token
      await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "c1",
        token: "ghp_first",
      });

      // Save second token
      await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "c1",
        token: "ghp_second",
      });

      const tokens = _sqlite.prepare("SELECT * FROM connection_tokens WHERE connection_id = 'c1' ORDER BY id").all() as any[];
      expect(tokens).toHaveLength(2);
      expect(tokens[0].is_current).toBe(0); // first token marked not current
      expect(tokens[1].is_current).toBe(1); // second token is current
    });

    it("saves trello credentials (multiple required fields)", async () => {
      createConnection(db, { id: "c4", provider: "trello", status: "active", metadata: "{}" });
      createAppState(db, { id: "trello", isConnected: false });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "trello",
        connectionId: "c4",
        token: "trello_token",
        apiKey: "trello_key",
      });
      expect(result.success).toBe(true);
    });

    it("returns error when trello apiKey missing", async () => {
      createConnection(db, { id: "c4", provider: "trello" });

      const result = await connectionCredentialsService.saveCredentials({
        provider: "trello",
        connectionId: "c4",
        token: "trello_token",
        // apiKey missing
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("apiKey is required");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // checkCredentials
  // ─────────────────────────────────────────────────────────────
  describe("checkCredentials", () => {
    it("returns error when provider is empty", async () => {
      const result = await connectionCredentialsService.checkCredentials("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider is required");
    });

    it("returns error when connection not found", async () => {
      const result = await connectionCredentialsService.checkCredentials("github");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection not found");
    });

    it("returns hasCredentials false when no tokens", async () => {
      createConnection(db, { id: "c1", provider: "github" });

      const result = await connectionCredentialsService.checkCredentials("github");
      expect(result.success).toBe(true);
      expect(result.data!.hasCredentials).toBe(false);
      expect(result.data!.connectionId).toBe("c1");
    });

    it("returns hasCredentials true when tokens exist", async () => {
      createConnection(db, { id: "c1", provider: "github", status: "active", metadata: "{}" });
      createAppState(db, { id: "github", isConnected: false });

      // Save credentials to create a token
      await connectionCredentialsService.saveCredentials({
        provider: "github",
        connectionId: "c1",
        token: "ghp_test",
      });

      const result = await connectionCredentialsService.checkCredentials("github");
      expect(result.success).toBe(true);
      expect(result.data!.hasCredentials).toBe(true);
      expect(result.data!.status).toBe("active");
    });
  });
});
