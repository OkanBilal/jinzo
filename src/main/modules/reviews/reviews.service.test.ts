import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createWorkspace,
  createReview,
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

import { reviewsService } from "./reviews.service";
import { reviewsRepo } from "./reviews.repo";

describe("reviewsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────
  // getByWorkspace
  // ───────────────────────────────────────────────────────────
  describe("getByWorkspace", () => {
    it("returns reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });

      const result = await reviewsService.getByWorkspace("ws-1");
      assertOk(result);
      expect(result.data!).toHaveLength(2);
    });

    it("returns empty for workspace with no reviews", async () => {
      const result = await reviewsService.getByWorkspace("ws-empty");
      assertOk(result);
      expect(result.data!).toEqual([]);
    });

    it("does not return reviews from other workspaces", async () => {
      const ws1 = createWorkspace(db, { id: "ws-1" });
      const ws2 = createWorkspace(db, { id: "ws-2" });
      createReview(db, { workspaceId: ws1.id, title: "R1" });
      createReview(db, { workspaceId: ws2.id, title: "R2" });

      const result = await reviewsService.getByWorkspace("ws-1");
      assertOk(result);
      expect(result.data!).toHaveLength(1);
      expect(result.data![0].title).toBe("R1");
    });

    it("respects the limit parameter", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });
      createReview(db, { workspaceId: ws.id, title: "R3" });

      const result = await reviewsService.getByWorkspace("ws-1", 2);
      assertOk(result);
      expect(result.data!).toHaveLength(2);
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(reviewsRepo, "findByWorkspace").mockRejectedValueOnce(
        new Error("DB error"),
      );

      const result = await reviewsService.getByWorkspace("ws-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get reviews");
    });
  });

  // ───────────────────────────────────────────────────────────
  // getById
  // ───────────────────────────────────────────────────────────
  describe("getById", () => {
    it("returns review when found", async () => {
      createReview(db, { id: "r-1", title: "Test" });

      const result = await reviewsService.getById("r-1");
      assertOk(result);
      expect(result.data!.title).toBe("Test");
      expect(result.data!.id).toBe("r-1");
    });

    it("returns all fields correctly", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const run = createRun(db, { id: "run-1" });
      createReview(db, {
        id: "r-1",
        workspaceId: ws.id,
        title: "Full Review",
        summary: "A summary",
        status: "in_review",
        runId: run.id,
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = await reviewsService.getById("r-1");
      assertOk(result);
      expect(result.data!.workspaceId).toBe("ws-1");
      expect(result.data!.title).toBe("Full Review");
      expect(result.data!.summary).toBe("A summary");
      expect(result.data!.status).toBe("in_review");
      expect(result.data!.runId).toBe("run-1");
      expect(result.data!.metadata).toEqual({ key: "value" });
      expect(result.data!.createdAt).toBeInstanceOf(Date);
      expect(result.data!.updatedAt).toBeInstanceOf(Date);
    });

    it("returns error when not found", async () => {
      const result = await reviewsService.getById("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Review not found");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(reviewsRepo, "findById").mockRejectedValueOnce(
        new Error("DB error"),
      );

      const result = await reviewsService.getById("r-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get review");
    });
  });

  // ───────────────────────────────────────────────────────────
  // create
  // ───────────────────────────────────────────────────────────
  describe("create", () => {
    it("creates a review and returns id", async () => {
      const result = await reviewsService.create({
        title: "New Review",
      });
      assertOk(result);
      expect(typeof result.data!).toBe("string");
    });

    it("creates review with all fields", async () => {
      const run = createRun(db, { id: "run-1" });
      const ws = createWorkspace(db, { id: "ws-1" });
      const result = await reviewsService.create({
        title: "Full Review",
        summary: "A summary",
        status: "in_review",
        runId: run.id,
        workspaceId: ws.id,
        metadata: { key: "value" },
      });
      assertOk(result);

      // Verify the created review
      const fetched = await reviewsService.getById(result.data!);
      assertOk(fetched);
      expect(fetched.data!.title).toBe("Full Review");
      expect(fetched.data!.summary).toBe("A summary");
      expect(fetched.data!.status).toBe("in_review");
      expect(fetched.data!.runId).toBe("run-1");
      expect(fetched.data!.workspaceId).toBe("ws-1");
      expect(fetched.data!.metadata).toEqual({ key: "value" });
    });

    it("creates review with custom id", async () => {
      const result = await reviewsService.create({
        id: "custom-id",
        title: "Custom ID Review",
      });
      assertOk(result);
      expect(result.data!).toBe("custom-id");
    });

    it("defaults status to open", async () => {
      const result = await reviewsService.create({
        title: "Default Status",
      });
      assertOk(result);

      const fetched = await reviewsService.getById(result.data);
      assertOk(fetched);
      expect(fetched.data.status).toBe("open");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(reviewsRepo, "insert").mockRejectedValueOnce(
        new Error("DB error"),
      );

      const result = await reviewsService.create({ title: "Fail" });
      assertFail(result);
      expect(result.error).toBe("Failed to create review");
    });
  });

  // ───────────────────────────────────────────────────────────
  // update
  // ───────────────────────────────────────────────────────────
  describe("update", () => {
    it("updates review title", async () => {
      createReview(db, { id: "r-1", title: "Old" });

      const result = await reviewsService.update("r-1", { title: "New" });
      assertOk(result);
      expect(result.data!.title).toBe("New");
    });

    it("updates review status", async () => {
      createReview(db, { id: "r-1", title: "Review", status: "open" });

      const result = await reviewsService.update("r-1", {
        status: "approved",
      });
      assertOk(result);
      expect(result.data!.status).toBe("approved");
    });

    it("updates review summary", async () => {
      createReview(db, { id: "r-1", title: "Review" });

      const result = await reviewsService.update("r-1", {
        summary: "New summary",
      });
      assertOk(result);
      expect(result.data!.summary).toBe("New summary");
    });

    it("updates review metadata", async () => {
      createReview(db, { id: "r-1", title: "Review" });

      const result = await reviewsService.update("r-1", {
        metadata: { score: 42 },
      });
      assertOk(result);
      expect(result.data!.metadata).toEqual({ score: 42 });
    });

    it("updates review runId", async () => {
      createReview(db, { id: "r-1", title: "Review" });
      const run = createRun(db, { id: "run-1" });

      const result = await reviewsService.update("r-1", { runId: run.id });
      assertOk(result);
      expect(result.data!.runId).toBe("run-1");
    });

    it("updates multiple fields at once", async () => {
      createReview(db, { id: "r-1", title: "Old", status: "open" });

      const result = await reviewsService.update("r-1", {
        title: "New",
        status: "rejected",
        summary: "Updated summary",
      });
      assertOk(result);
      expect(result.data!.title).toBe("New");
      expect(result.data!.status).toBe("rejected");
      expect(result.data!.summary).toBe("Updated summary");
    });

    it("returns error when review not found", async () => {
      const result = await reviewsService.update("nonexistent", {
        title: "X",
      });
      assertFail(result);
      expect(result.error).toBe("Review not found");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(reviewsRepo, "update").mockRejectedValueOnce(
        new Error("DB error"),
      );

      const result = await reviewsService.update("r-1", { title: "Fail" });
      assertFail(result);
      expect(result.error).toBe("Failed to update review");
    });
  });

  // ───────────────────────────────────────────────────────────
  // delete
  // ───────────────────────────────────────────────────────────
  describe("delete", () => {
    it("deletes a review", async () => {
      createReview(db, { id: "r-1" });

      const result = await reviewsService.delete("r-1");
      assertOk(result);

      // Verify it is gone
      const fetched = await reviewsService.getById("r-1");
      assertFail(fetched);
      expect(fetched.error).toBe("Review not found");
    });

    it("succeeds even when review does not exist", async () => {
      const result = await reviewsService.delete("nonexistent");
      assertOk(result);
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(reviewsRepo, "remove").mockRejectedValueOnce(
        new Error("DB error"),
      );

      const result = await reviewsService.delete("r-1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete review");
    });
  });
});
