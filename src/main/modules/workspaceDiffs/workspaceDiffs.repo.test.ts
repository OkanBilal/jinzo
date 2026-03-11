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

import { workspaceDiffsRepo } from "./workspaceDiffs.repo";

describe("workspaceDiffsRepo", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("insertDiff", () => {
    it("inserts a diff and returns its id", async () => {
      const id = await workspaceDiffsRepo.insertDiff({
        id: "diff-1",
        workspaceId: wsId,
        diffText: "--- a/file.ts\n+++ b/file.ts",
      });

      expect(id).toBe("diff-1");
    });

    it("stores optional fields", async () => {
      const run = createRun(db, { workspaceId: wsId });

      await workspaceDiffsRepo.insertDiff({
        id: "diff-2",
        workspaceId: wsId,
        runId: run.id,
        baseRef: "abc123",
        diffText: "some diff",
        filesJson: JSON.stringify(["file1.ts", "file2.ts"]),
        statsJson: JSON.stringify({ shortstat: "2 files changed", files: 2 }),
      });

      const result = await workspaceDiffsRepo.findByWorkspace(wsId);
      expect(result).toHaveLength(1);
      expect(result[0].baseRef).toBe("abc123");
      expect(result[0].files).toEqual(["file1.ts", "file2.ts"]);
      expect(result[0].stats).toEqual({ shortstat: "2 files changed", files: 2 });
    });
  });

  describe("findByWorkspace", () => {
    it("returns empty array when no diffs", async () => {
      const result = await workspaceDiffsRepo.findByWorkspace(wsId);
      expect(result).toEqual([]);
    });

    it("returns diffs ordered by createdAt desc", async () => {
      createWorkspaceDiff(db, { id: "d1", workspaceId: wsId, diffText: "diff 1" });
      createWorkspaceDiff(db, { id: "d2", workspaceId: wsId, diffText: "diff 2" });

      const result = await workspaceDiffsRepo.findByWorkspace(wsId);
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        createWorkspaceDiff(db, { workspaceId: wsId, diffText: `diff ${i}` });
      }

      const result = await workspaceDiffsRepo.findByWorkspace(wsId, 2);
      expect(result).toHaveLength(2);
    });
  });

  describe("findLatestByWorkspace", () => {
    it("returns null when no diffs", async () => {
      const result = await workspaceDiffsRepo.findLatestByWorkspace(wsId);
      expect(result).toBeNull();
    });

    it("returns the most recent diff", async () => {
      createWorkspaceDiff(db, { id: "d1", workspaceId: wsId, diffText: "old" });
      createWorkspaceDiff(db, { id: "d2", workspaceId: wsId, diffText: "new" });

      const result = await workspaceDiffsRepo.findLatestByWorkspace(wsId);
      expect(result).not.toBeNull();
    });
  });

  describe("findByRun", () => {
    it("returns null when no diff for run", async () => {
      const result = await workspaceDiffsRepo.findByRun("nonexistent-run");
      expect(result).toBeNull();
    });

    it("returns the diff linked to a run", async () => {
      const run = createRun(db, { workspaceId: wsId });
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        runId: run.id,
        diffText: "run diff",
      });

      const result = await workspaceDiffsRepo.findByRun(run.id);
      expect(result).not.toBeNull();
      expect(result!.diffText).toBe("run diff");
    });
  });

  describe("deleteByWorkspace", () => {
    it("deletes all diffs for a workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId });
      createWorkspaceDiff(db, { workspaceId: wsId });

      await workspaceDiffsRepo.deleteByWorkspace(wsId);

      const result = await workspaceDiffsRepo.findByWorkspace(wsId);
      expect(result).toHaveLength(0);
    });
  });

  describe("findByWorkspaceAndBaseRef", () => {
    it("returns null when not found", async () => {
      const result = await workspaceDiffsRepo.findByWorkspaceAndBaseRef(wsId, "abc");
      expect(result).toBeNull();
    });

    it("finds diff by workspace + baseRef", async () => {
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        baseRef: "sha-abc",
        diffText: "matched diff",
      });

      const result = await workspaceDiffsRepo.findByWorkspaceAndBaseRef(wsId, "sha-abc");
      expect(result).not.toBeNull();
      expect(result!.diffText).toBe("matched diff");
    });
  });
});
