import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
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

import { workspaceDiffsController } from "./workspaceDiffs.controller";

describe("workspaceDiffsController", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── getByWorkspace ──────────────────────────────────────
  describe("getByWorkspace", () => {
    it("returns empty array when no diffs exist", async () => {
      const result = await workspaceDiffsController.getByWorkspace(wsId);
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns diffs for a workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "diff 1" });
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "diff 2" });

      const result = await workspaceDiffsController.getByWorkspace(wsId);
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "a" });
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "b" });
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "c" });

      const result = await workspaceDiffsController.getByWorkspace(wsId, 2);
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });
  });

  // ─── getLatest ───────────────────────────────────────────
  describe("getLatest", () => {
    it("returns the latest diff for a workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "old diff" });
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "latest diff" });

      const result = await workspaceDiffsController.getLatest(wsId);
      assertOk(result);
      expect(result.data).toBeDefined();
      expect(result.data!.diffText).toBeDefined();
    });

    it("returns error when no diffs exist", async () => {
      const result = await workspaceDiffsController.getLatest(wsId);
      assertFail(result);
    });
  });

  // ─── getByRun ────────────────────────────────────────────
  describe("getByRun", () => {
    it("returns diff associated with a run", async () => {
      const run = createRun(db, { workspaceId: wsId });
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        runId: run.id,
        diffText: "run diff",
      });

      const result = await workspaceDiffsController.getByRun(run.id);
      assertOk(result);
      expect(result.data!.diffText).toBe("run diff");
      expect(result.data!.runId).toBe(run.id);
    });

    it("returns error when no diff for run", async () => {
      const result = await workspaceDiffsController.getByRun("nonexistent-run");
      assertFail(result);
    });
  });
});
