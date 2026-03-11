import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createWorkspace, createReview, createRun } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { reviewsService } from "./reviews.service";

describe("reviewsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByWorkspace", () => {
    it("returns reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });

      const result = await reviewsService.getByWorkspace("ws-1");
      expect(result.success).toBe(true);
      expect(result.data!).toHaveLength(1);
    });

    it("returns empty for workspace with no reviews", async () => {
      const result = await reviewsService.getByWorkspace("ws-empty");
      expect(result.success).toBe(true);
      expect(result.data!).toEqual([]);
    });
  });

  describe("getById", () => {
    it("returns review when found", async () => {
      createReview(db, { id: "r-1", title: "Test" });

      const result = await reviewsService.getById("r-1");
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe("Test");
    });

    it("returns error when not found", async () => {
      const result = await reviewsService.getById("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Review not found");
    });
  });

  describe("create", () => {
    it("creates a review and returns id", async () => {
      const result = await reviewsService.create({
        title: "New Review",
      });
      expect(result.success).toBe(true);
      expect(typeof result.data!).toBe("string");
    });

    it("creates review with all fields", async () => {
      const run = createRun(db, { id: "run-1" });
      const result = await reviewsService.create({
        title: "Full Review",
        summary: "A summary",
        status: "in_review",
        runId: run.id,
        metadata: { key: "value" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("update", () => {
    it("updates review fields", async () => {
      createReview(db, { id: "r-1", title: "Old" });

      const result = await reviewsService.update("r-1", { title: "New" });
      expect(result.success).toBe(true);
      expect(result.data!.title).toBe("New");
    });

    it("returns error when review not found", async () => {
      const result = await reviewsService.update("nonexistent", { title: "X" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Review not found");
    });
  });

  describe("delete", () => {
    it("deletes a review", async () => {
      createReview(db, { id: "r-1" });

      const result = await reviewsService.delete("r-1");
      expect(result.success).toBe(true);
    });
  });
});
