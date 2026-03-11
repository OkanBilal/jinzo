import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createWorkspace,
  createWorkspaceDiff,
  createRun,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { workspaceDiffsService } from "./workspaceDiffs.service";
import { workspaceDiffsRepo } from "./workspaceDiffs.repo";

describe("workspaceDiffsService", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByWorkspace", () => {
    it("returns empty list", async () => {
      const result = await workspaceDiffsService.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns diffs for workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId });
      createWorkspaceDiff(db, { workspaceId: wsId });

      const result = await workspaceDiffsService.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getLatest", () => {
    it("returns error when no diffs", async () => {
      const result = await workspaceDiffsService.getLatest(wsId);
      expect(result.success).toBe(false);
      expect(result.error).toBe("No diff found for this workspace");
    });

    it("returns latest diff", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "latest" });

      const result = await workspaceDiffsService.getLatest(wsId);
      expect(result.success).toBe(true);
      expect(result.data!.diffText).toBe("latest");
    });
  });

  describe("getByRun", () => {
    it("returns error when no diff for run", async () => {
      const result = await workspaceDiffsService.getByRun("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No diff found for this run");
    });

    it("returns diff linked to run", async () => {
      const run = createRun(db, { workspaceId: wsId });
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        runId: run.id,
        diffText: "run-diff",
      });

      const result = await workspaceDiffsService.getByRun(run.id);
      expect(result.success).toBe(true);
      expect(result.data!.diffText).toBe("run-diff");
    });
  });

  describe("createDiff", () => {
    it("creates a diff and returns id", async () => {
      const result = await workspaceDiffsService.createDiff({
        id: "new-diff",
        workspaceId: wsId,
        diffText: "new diff content",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe("new-diff");
    });

    it("creates a diff with all optional fields", async () => {
      const run = createRun(db, { workspaceId: wsId });
      const result = await workspaceDiffsService.createDiff({
        id: "full-diff",
        workspaceId: wsId,
        runId: run.id,
        baseRef: "abc123",
        diffText: "full diff",
        filesJson: '["file.ts"]',
        statsJson: '{"insertions":5}',
      });
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getByWorkspace returns error on failure", async () => {
      vi.spyOn(workspaceDiffsRepo, "findByWorkspace").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceDiffsService.getByWorkspace("ws-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspace diffs");
    });

    it("getLatest returns error on failure", async () => {
      vi.spyOn(workspaceDiffsRepo, "findLatestByWorkspace").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceDiffsService.getLatest("ws-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get latest workspace diff");
    });

    it("getByRun returns error on failure", async () => {
      vi.spyOn(workspaceDiffsRepo, "findByRun").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceDiffsService.getByRun("r1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get run diff");
    });

    it("createDiff returns error on failure", async () => {
      vi.spyOn(workspaceDiffsRepo, "insertDiff").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceDiffsService.createDiff({
        id: "x",
        workspaceId: "ws-1",
        diffText: "x",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create workspace diff");
    });
  });
});
