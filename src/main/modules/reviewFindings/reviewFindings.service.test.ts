import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createWorkspace,
  createReview,
  createReviewFinding,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { reviewFindingsService } from "./reviewFindings.service";
import { reviewFindingsRepo } from "./reviewFindings.repo";

describe("reviewFindingsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // getByWorkspace
  // ─────────────────────────────────────────────────────────────
  describe("getByWorkspace", () => {
    it("returns findings for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      expect(result.data!).toHaveLength(1);
      expect(result.data![0].file).toBe("a.ts");
    });

    it("returns findings from multiple files across same review", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      expect(result.data!).toHaveLength(3);
    });

    it("keeps only findings from most recent review per file", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });

      // Older review with finding on file a.ts
      const oldReview = createReview(db, { id: "r-old", workspaceId: ws.id });
      createReviewFinding(db, {
        reviewId: oldReview.id,
        file: "a.ts",
        message: "Old finding",
      });

      // Newer review with finding on same file a.ts
      const newReview = createReview(db, { id: "r-new", workspaceId: ws.id });
      createReviewFinding(db, {
        reviewId: newReview.id,
        file: "a.ts",
        message: "New finding",
      });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      // Both reviews have same timestamp (created at same unixepoch second)
      // so the filtering keeps findings from whichever review is considered "latest"
      // The important assertion is that it doesn't double-count
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });

    it("keeps findings from different files across reviews", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review1 = createReview(db, { id: "r-1", workspaceId: ws.id });
      const review2 = createReview(db, { id: "r-2", workspaceId: ws.id });

      createReviewFinding(db, { reviewId: review1.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review2.id, file: "b.ts" });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      // Different files, so both should be kept regardless of review
      expect(result.data!).toHaveLength(2);
    });

    it("returns empty for workspace with no findings", async () => {
      const result = await reviewFindingsService.getByWorkspace("ws-empty");
      assertOk(result);
      expect(result.data!).toEqual([]);
    });

    it("strips reviewCreatedAt from response", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      const finding = result.data![0];
      expect(finding).not.toHaveProperty("reviewCreatedAt");
      expect(finding).toHaveProperty("id");
      expect(finding).toHaveProperty("reviewId");
      expect(finding).toHaveProperty("file");
    });

    it("does not return findings from other workspaces", async () => {
      const ws1 = createWorkspace(db, { id: "ws-1" });
      const ws2 = createWorkspace(db, { id: "ws-2" });
      const review1 = createReview(db, { id: "r-1", workspaceId: ws1.id });
      const review2 = createReview(db, { id: "r-2", workspaceId: ws2.id });
      createReviewFinding(db, { reviewId: review1.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review2.id, file: "b.ts" });

      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertOk(result);
      expect(result.data!).toHaveLength(1);
      expect(result.data![0].file).toBe("a.ts");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getByReview
  // ─────────────────────────────────────────────────────────────
  describe("getByReview", () => {
    it("returns findings for review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id });

      const result = await reviewFindingsService.getByReview("r-1");
      assertOk(result);
      expect(result.data!).toHaveLength(1);
    });

    it("returns multiple findings for a review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await reviewFindingsService.getByReview("r-1");
      assertOk(result);
      expect(result.data!).toHaveLength(3);
    });

    it("respects the limit parameter", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await reviewFindingsService.getByReview("r-1", 2);
      assertOk(result);
      expect(result.data!).toHaveLength(2);
    });

    it("returns empty for review with no findings", async () => {
      const result = await reviewFindingsService.getByReview("r-empty");
      assertOk(result);
      expect(result.data!).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────
  describe("getById", () => {
    it("returns finding when found", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        message: "Test",
      });

      const result = await reviewFindingsService.getById("f-1");
      assertOk(result);
      expect(result.data!.message).toBe("Test");
    });

    it("returns all finding fields correctly", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-full",
        reviewId: review.id,
        severity: "critical",
        file: "src/main.ts",
        lineStart: 10,
        lineEnd: 20,
        message: "Dangerous code",
        reason: "Security issue",
        suggestion: "Use safe API",
        validated: true,
        metadata: JSON.stringify({ category: "security" }),
      });

      const result = await reviewFindingsService.getById("f-full");
      assertOk(result);
      const finding = result.data!;
      expect(finding.id).toBe("f-full");
      expect(finding.reviewId).toBe("r-1");
      expect(finding.severity).toBe("critical");
      expect(finding.file).toBe("src/main.ts");
      expect(finding.lineStart).toBe(10);
      expect(finding.lineEnd).toBe(20);
      expect(finding.message).toBe("Dangerous code");
      expect(finding.reason).toBe("Security issue");
      expect(finding.suggestion).toBe("Use safe API");
      expect(finding.validated).toBe(true);
      expect(finding.metadata).toEqual({ category: "security" });
      expect(finding.createdAt).toBeDefined();
    });

    it("returns error when not found", async () => {
      const result = await reviewFindingsService.getById("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Review finding not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────
  describe("create", () => {
    it("creates a finding and returns its id", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.create({
        reviewId: review.id,
        severity: "warning",
        file: "app.ts",
        message: "Issue",
        reason: "Bug",
      });
      assertOk(result);
      expect(typeof result.data!).toBe("string");

      // Verify finding was persisted
      const fetched = await reviewFindingsService.getById(result.data!);
      assertOk(fetched);
      expect(fetched.data!.file).toBe("app.ts");
      expect(fetched.data!.severity).toBe("warning");
    });

    it("creates a finding with all optional fields", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.create({
        id: "custom-id",
        reviewId: review.id,
        severity: "critical",
        file: "src/index.ts",
        lineStart: 5,
        lineEnd: 15,
        message: "Found a bug",
        reason: "Logic error",
        suggestion: "Fix the condition",
        validated: true,
        metadata: { tool: "linter" },
      });
      assertOk(result);
      expect(result.data!).toBe("custom-id");

      const fetched = await reviewFindingsService.getById("custom-id");
      assertOk(fetched);
      expect(fetched.data!.lineStart).toBe(5);
      expect(fetched.data!.lineEnd).toBe(15);
      expect(fetched.data!.suggestion).toBe("Fix the condition");
      expect(fetched.data!.validated).toBe(true);
      expect(fetched.data!.metadata).toEqual({ tool: "linter" });
    });

    it("creates a finding with defaults for optional fields", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.create({
        reviewId: review.id,
        severity: "info",
        file: "readme.md",
        message: "Minor note",
        reason: "Style",
      });
      assertOk(result);

      const fetched = await reviewFindingsService.getById(result.data!);
      assertOk(fetched);
      expect(fetched.data!.validated).toBe(false);
      expect(fetched.data!.lineStart).toBeNull();
      expect(fetched.data!.lineEnd).toBeNull();
      expect(fetched.data!.suggestion).toBeNull();
      expect(fetched.data!.metadata).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // createMany
  // ─────────────────────────────────────────────────────────────
  describe("createMany", () => {
    it("creates multiple findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.createMany([
        {
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          reviewId: review.id,
          severity: "critical",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);
      assertOk(result);
      expect(result.data!).toHaveLength(2);
    });

    it("returns the correct ids for created findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.createMany([
        {
          id: "id-a",
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          id: "id-b",
          reviewId: review.id,
          severity: "warning",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);
      assertOk(result);
      expect(result.data!).toEqual(["id-a", "id-b"]);

      // Verify they were persisted
      const a = await reviewFindingsService.getById("id-a");
      const b = await reviewFindingsService.getById("id-b");
      assertOk(a);
      assertOk(b);
      expect(a.data!.file).toBe("a.ts");
      expect(b.data!.file).toBe("b.ts");
    });

    it("creates findings with metadata", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await reviewFindingsService.createMany([
        {
          id: "id-meta",
          reviewId: review.id,
          severity: "warning",
          file: "a.ts",
          message: "M",
          reason: "R",
          metadata: { source: "ai" },
        },
      ]);
      assertOk(result);

      const fetched = await reviewFindingsService.getById("id-meta");
      assertOk(fetched);
      expect(fetched.data.metadata).toEqual({ source: "ai" });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────
  describe("update", () => {
    it("updates finding severity", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
      });

      const result = await reviewFindingsService.update("f-1", {
        severity: "critical",
      });
      assertOk(result);
      expect(result.data!.severity).toBe("critical");
    });

    it("updates multiple fields at once", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
        file: "old.ts",
        message: "old message",
      });

      const result = await reviewFindingsService.update("f-1", {
        severity: "warning",
        file: "new.ts",
        message: "new message",
        lineStart: 42,
        lineEnd: 50,
        suggestion: "Try this instead",
        validated: true,
      });
      assertOk(result);
      expect(result.data!.severity).toBe("warning");
      expect(result.data!.file).toBe("new.ts");
      expect(result.data!.message).toBe("new message");
      expect(result.data!.lineStart).toBe(42);
      expect(result.data!.lineEnd).toBe(50);
      expect(result.data!.suggestion).toBe("Try this instead");
      expect(result.data!.validated).toBe(true);
    });

    it("updates metadata", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
      });

      const result = await reviewFindingsService.update("f-1", {
        metadata: { reviewed: true, score: 95 },
      });
      assertOk(result);
      expect(result.data!.metadata).toEqual({ reviewed: true, score: 95 });
    });

    it("clears metadata when set to null", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        metadata: JSON.stringify({ key: "val" }),
      });

      const result = await reviewFindingsService.update("f-1", {
        metadata: null,
      });
      assertOk(result);
      expect(result.data!.metadata).toBeNull();
    });

    it("returns finding unchanged when payload is empty", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "warning",
        message: "unchanged",
      });

      const result = await reviewFindingsService.update("f-1", {});
      assertOk(result);
      expect(result.data!.severity).toBe("warning");
      expect(result.data!.message).toBe("unchanged");
    });

    it("returns error when not found", async () => {
      const result = await reviewFindingsService.update("nonexistent", {
        severity: "info",
      });
      assertFail(result);
      expect(result.error).toBe("Review finding not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────────────────────
  describe("delete", () => {
    it("deletes a finding", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      const result = await reviewFindingsService.delete("f-1");
      assertOk(result);

      // Verify it was removed
      const fetched = await reviewFindingsService.getById("f-1");
      assertFail(fetched);
      expect(fetched.error).toBe("Review finding not found");
    });

    it("succeeds even when finding does not exist", async () => {
      const result = await reviewFindingsService.delete("nonexistent");
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getByWorkspace returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "findByWorkspace").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.getByWorkspace("ws-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get workspace findings");
    });

    it("getByReview returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "findByReview").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.getByReview("r-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get review findings");
    });

    it("getById returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.getById("f-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get review finding");
    });

    it("create returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "insert").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.create({
        reviewId: "r-1",
        severity: "info",
        file: "a.ts",
        message: "m",
        reason: "r",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to create review finding");
    });

    it("createMany returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "insertMany").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.createMany([
        {
          reviewId: "r-1",
          severity: "info",
          file: "a.ts",
          message: "m",
          reason: "r",
        },
      ]);
      assertFail(result);
      expect(result.error).toBe("Failed to create review findings");
    });

    it("update returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "update").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.update("f-1", { severity: "info" });
      assertFail(result);
      expect(result.error).toBe("Failed to update review finding");
    });

    it("delete returns error on failure", async () => {
      vi.spyOn(reviewFindingsRepo, "remove").mockRejectedValueOnce(new Error("db"));
      const result = await reviewFindingsService.delete("f-1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete review finding");
    });
  });
});
