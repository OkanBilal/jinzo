import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createConnection, createAppState } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

import { connectionCredentialsRepo } from "./connectionCredentials.repo";

describe("connectionCredentialsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // Connection queries
  // ─────────────────────────────────────────────────────────────
  describe("findConnectionById", () => {
    it("returns undefined when not found", async () => {
      const result = await connectionCredentialsRepo.findConnectionById("nope");
      expect(result).toBeUndefined();
    });

    it("returns connection", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      const result = await connectionCredentialsRepo.findConnectionById("c1");
      expect(result).toBeDefined();
      expect(result!.provider).toBe("github");
    });
  });

  describe("findConnectionByProvider", () => {
    it("returns undefined when not found", async () => {
      const result = await connectionCredentialsRepo.findConnectionByProvider("github");
      expect(result).toBeUndefined();
    });

    it("returns connection for provider", async () => {
      createConnection(db, { id: "c1", provider: "linear" });
      const result = await connectionCredentialsRepo.findConnectionByProvider("linear");
      expect(result).toBeDefined();
      expect(result!.id).toBe("c1");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Token operations
  // ─────────────────────────────────────────────────────────────
  describe("insertToken + findTokensByConnectionId", () => {
    it("inserts and retrieves tokens", async () => {
      createConnection(db, { id: "c1" });

      await connectionCredentialsRepo.insertToken({
        connectionId: "c1",
        accessTokenEnc: Buffer.from("encrypted-secret"),
        refreshTokenEnc: null,
        tokenType: "bearer",
        expiresAt: null,
        tokenHash: Buffer.from("hash"),
        keyVersion: 1,
        isCurrent: true,
      });

      const tokens = await connectionCredentialsRepo.findTokensByConnectionId("c1");
      expect(tokens).toHaveLength(1);
      expect(tokens[0].isCurrent).toBe(true);
      expect(tokens[0].tokenType).toBe("bearer");
    });
  });

  describe("markTokensNotCurrent", () => {
    it("marks all tokens as not current", async () => {
      createConnection(db, { id: "c1" });

      await connectionCredentialsRepo.insertToken({
        connectionId: "c1",
        accessTokenEnc: Buffer.from("secret1"),
        refreshTokenEnc: null,
        tokenType: "bearer",
        expiresAt: null,
        tokenHash: Buffer.from("h1"),
        keyVersion: 1,
        isCurrent: true,
      });

      // Mark first token not current before inserting second (unique constraint)
      await connectionCredentialsRepo.markTokensNotCurrent("c1");

      await connectionCredentialsRepo.insertToken({
        connectionId: "c1",
        accessTokenEnc: Buffer.from("secret2"),
        refreshTokenEnc: null,
        tokenType: "bearer",
        expiresAt: null,
        tokenHash: Buffer.from("h2"),
        keyVersion: 1,
        isCurrent: true,
      });

      // Now mark all not current
      await connectionCredentialsRepo.markTokensNotCurrent("c1");

      const tokens = await connectionCredentialsRepo.findTokensByConnectionId("c1");
      expect(tokens).toHaveLength(2);
      expect(tokens.every((t) => t.isCurrent === false)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Connection status
  // ─────────────────────────────────────────────────────────────
  describe("updateConnectionStatus", () => {
    it("updates status and metadata", async () => {
      createConnection(db, { id: "c1", provider: "github", status: "active" });

      await connectionCredentialsRepo.updateConnectionStatus("c1", "revoked", '{"reason":"test"}');

      const conn = await connectionCredentialsRepo.findConnectionById("c1");
      expect(conn!.status).toBe("revoked");
      expect(conn!.metadata).toBe('{"reason":"test"}');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // App state
  // ─────────────────────────────────────────────────────────────
  describe("updateAppState", () => {
    it("updates app state", async () => {
      createConnection(db, { id: "c1", provider: "github" });
      createAppState(db, { id: "github", isConnected: false });

      await connectionCredentialsRepo.updateAppState("github", "c1", true);

      // Verify via raw query
      const row = _sqlite.prepare("SELECT * FROM app_states WHERE id = 'github'").get() as any;
      expect(row.is_connected).toBe(1);
      expect(row.connection_id).toBe("c1");
    });
  });
});
