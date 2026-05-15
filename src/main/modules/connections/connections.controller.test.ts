import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createConnection,
  createConnectionResource,
  createConnectionState,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

vi.mock("@octokit/rest", () => ({ Octokit: vi.fn() }));
vi.mock("@linear/sdk", () => ({ LinearClient: vi.fn() }));
vi.mock("../connectionCredentials/connectionCredentials.utils", () => ({
  decryptSecrets: vi.fn((buf: Buffer) => JSON.parse(buf.toString("utf-8"))),
}));

// Import after mocks
const { connectionsController } = await import("./connections.controller");

describe("connectionsController", () => {
  beforeEach(() => {
    const result = createTestDb();
    db = result.db;
    _sqlite = result.sqlite;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  // ── getByProvider ───────────────────────────────────────────
  describe("getByProvider", () => {
    it("returns connection when found", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });

      const res = await connectionsController.getByProvider("github");
      assertOk(res);
      if (res.success) {
        expect(res.data.connection.id).toBe("conn-gh");
        expect(res.data.connection.provider).toBe("github");
      }
    });

    it("returns error when connection not found", async () => {
      const res = await connectionsController.getByProvider("nonexistent");
      assertFail(res);
      if (!res.success) expect(res.error).toContain("not found");
    });

    it("returns error for empty provider string", async () => {
      const res = await connectionsController.getByProvider("");
      assertFail(res);
    });
  });

  // ── getSelectedResources ────────────────────────────────────
  describe("getSelectedResources", () => {
    it("returns selected github repos", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionResource(db, {
        id: "conn-gh:repo-1",
        connectionId: "conn-gh",
        externalId: "org/repo-1",
        kind: "github_repo",
        name: "org/repo-1",
        selected: true,
      });

      const res = await connectionsController.getSelectedResources("github");
      assertOk(res);
      if (res.success) {
        expect((res.data as any).repos).toHaveLength(1);
        expect((res.data as any).connectionId).toBe("conn-gh");
      }
    });

    it("returns empty array when no selected resources", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionResource(db, {
        id: "conn-gh:repo-1",
        connectionId: "conn-gh",
        externalId: "org/repo-1",
        kind: "github_repo",
        name: "org/repo-1",
        selected: false,
      });

      const res = await connectionsController.getSelectedResources("github");
      assertOk(res);
      if (res.success) expect((res.data as any).repos).toHaveLength(0);
    });

    it("returns error for unsupported provider", async () => {
      const res = await connectionsController.getSelectedResources("unknown_provider");
      assertFail(res);
      if (!res.success) expect(res.error).toContain("Unsupported");
    });

    it("returns error when connection not found", async () => {
      const res = await connectionsController.getSelectedResources("github");
      assertFail(res);
      if (!res.success) expect(res.error).toContain("not found");
    });
  });

  // ── saveResources ───────────────────────────────────────────
  describe("saveResources", () => {
    it("saves github repos as resources", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });

      const res = await connectionsController.saveResources({
        provider: "github",
        connectionId: "conn-gh",
        resources: [
          {
            id: 1,
            fullName: "org/repo",
            name: "repo",
            owner: "org",
            private: false,
            description: null,
            language: "TypeScript",
            stars: 10,
            forks: 2,
            defaultBranch: "main",
            htmlUrl: "https://github.com/org/repo",
            updatedAt: null,
          },
        ],
      });
      assertOk(res);
      if (res.success) expect(res.data.count).toBe(1);

      // Verify resource was saved
      const selected = await connectionsController.getSelectedResources("github");
      assertOk(selected);
      if (selected.success) expect((selected.data as any).repos).toHaveLength(1);
    });

    it("returns error when provider is missing", async () => {
      const res = await connectionsController.saveResources({
        provider: "",
        connectionId: "conn-gh",
        resources: [],
      });
      assertFail(res);
    });

    it("returns error when resources are empty", async () => {
      const res = await connectionsController.saveResources({
        provider: "github",
        connectionId: "conn-gh",
        resources: [],
      });
      assertFail(res);
      if (!res.success) expect(res.error).toContain("required");
    });

    it("returns error for unsupported provider", async () => {
      const res = await connectionsController.saveResources({
        provider: "unknown",
        connectionId: "conn-1",
        resources: [{}],
      });
      assertFail(res);
      if (!res.success) expect(res.error).toContain("Unsupported");
    });
  });

  // ── removeResource ──────────────────────────────────────────
  describe("removeResource", () => {
    it("removes an existing resource", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionResource(db, {
        id: "conn-gh:repo-1",
        connectionId: "conn-gh",
        externalId: "org/repo-1",
        kind: "github_repo",
      });

      const res = await connectionsController.removeResource("conn-gh:repo-1");
      assertOk(res);
      if (res.success) expect(res.data.message).toContain("removed");
    });

    it("returns error for nonexistent resource", async () => {
      const res = await connectionsController.removeResource("nonexistent");
      assertFail(res);
      if (!res.success) expect(res.error).toContain("not found");
    });

    it("returns error for empty resource id", async () => {
      const res = await connectionsController.removeResource("");
      assertFail(res);
    });
  });

  // ── deleteResource ──────────────────────────────────────────
  describe("deleteResource", () => {
    it("deletes an existing resource", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionResource(db, {
        id: "conn-gh:repo-1",
        connectionId: "conn-gh",
        externalId: "org/repo-1",
        kind: "github_repo",
      });

      const res = await connectionsController.deleteResource("conn-gh:repo-1");
      assertOk(res);
    });

    it("returns error for empty resource id", async () => {
      const res = await connectionsController.deleteResource("");
      assertFail(res);
    });
  });

  // ── revoke ──────────────────────────────────────────────────
  describe("revoke", () => {
    it("revokes an existing connection", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionState(db, { id: "github", isConnected: true, connectionId: "conn-gh" });

      const res = await connectionsController.revoke("github");
      assertOk(res);

      // Connection should still exist but be revoked
      const conn = await connectionsController.getByProvider("github");
      assertOk(conn);
      if (conn.success) expect(conn.data.connection.status).toBe("revoked");
    });

    it("returns error when connection not found", async () => {
      const res = await connectionsController.revoke("nonexistent");
      assertFail(res);
      if (!res.success) expect(res.error).toContain("not found");
    });

    it("returns error for empty provider", async () => {
      const res = await connectionsController.revoke("");
      assertFail(res);
    });

    it("cleans up resources on revoke", async () => {
      createConnection(db, { id: "conn-gh", provider: "github", type: "oauth" });
      createConnectionState(db, { id: "github", isConnected: true, connectionId: "conn-gh" });
      createConnectionResource(db, {
        id: "conn-gh:repo-1",
        connectionId: "conn-gh",
        externalId: "org/repo-1",
        kind: "github_repo",
        selected: true,
      });

      const res = await connectionsController.revoke("github");
      assertOk(res);

      // Resources should be deleted
      const selected = await connectionsController.getSelectedResources("github");
      assertOk(selected);
      if (selected.success) expect((selected.data as any).repos).toHaveLength(0);
    });
  });
});
