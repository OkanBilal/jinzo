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

import { reviewFindingsRepo } from "./reviewFindings.repo";

describe("reviewFindingsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findByReview", () => {
    it("returns empty array when no findings", async () => {
      const result = await reviewFindingsRepo.findByReview("review-1");
      expect(result).toEqual([]);
    });

    it("returns findings for review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: "other-review" });

      const result = await reviewFindingsRepo.findByReview("r-1");
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      const review = createReview(db, { id: "r-1" });
      for (let i = 0; i < 5; i++) {
        createReviewFinding(db, { reviewId: review.id, file: `file${i}.ts` });
      }

      const result = await reviewFindingsRepo.findByReview("r-1", 3);
      expect(result).toHaveLength(3);
    });
  });

  describe("findByWorkspace", () => {
    it("returns findings via workspace join", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { id: "r-1", workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "x.ts" });

      const result = await reviewFindingsRepo.findByWorkspace("ws-1");
      expect(result).toHaveLength(1);
      expect(result[0].reviewCreatedAt).toBeDefined();
    });

    it("returns empty for workspace with no reviews", async () => {
      const result = await reviewFindingsRepo.findByWorkspace("ws-empty");
      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("returns null when not found", async () => {
      const result = await reviewFindingsRepo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns finding when found", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        file: "src/app.ts",
        message: "Missing null check",
        severity: "critical",
      });

      const result = await reviewFindingsRepo.findById("f-1");
      expect(result).not.toBeNull();
      expect(result!.file).toBe("src/app.ts");
      expect(result!.severity).toBe("critical");
      expect(result!.message).toBe("Missing null check");
    });
  });

  describe("insert", () => {
    it("inserts a finding and returns id", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await reviewFindingsRepo.insert({
        reviewId: review.id,
        severity: "warning",
        file: "index.ts",
        message: "Unused import",
        reason: "Dead code",
      });
      expect(id).toBeDefined();

      const finding = await reviewFindingsRepo.findById(id);
      expect(finding!.file).toBe("index.ts");
      expect(finding!.validated).toBe(false);
    });

    it("stores metadata as JSON", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await reviewFindingsRepo.insert({
        reviewId: review.id,
        severity: "info",
        file: "a.ts",
        message: "Note",
        reason: "FYI",
        metadata: { tool: "eslint" },
      });

      const finding = await reviewFindingsRepo.findById(id);
      expect(finding!.metadata).toEqual({ tool: "eslint" });
    });

    it("stores line range", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await reviewFindingsRepo.insert({
        reviewId: review.id,
        severity: "critical",
        file: "app.ts",
        lineStart: 10,
        lineEnd: 20,
        message: "Issue",
        reason: "Bug",
      });

      const finding = await reviewFindingsRepo.findById(id);
      expect(finding!.lineStart).toBe(10);
      expect(finding!.lineEnd).toBe(20);
    });
  });

  describe("insertMany", () => {
    it("inserts multiple findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const ids = await reviewFindingsRepo.insertMany([
        {
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          reviewId: review.id,
          severity: "warning",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);

      expect(ids).toHaveLength(2);
      const findings = await reviewFindingsRepo.findByReview(review.id);
      expect(findings).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("updates severity", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
      });

      const result = await reviewFindingsRepo.update("f-1", {
        severity: "critical",
      });
      expect(result!.severity).toBe("critical");
    });

    it("updates validated flag", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      const result = await reviewFindingsRepo.update("f-1", {
        validated: true,
      });
      expect(result!.validated).toBe(true);
    });

    it("returns null when not found", async () => {
      const result = await reviewFindingsRepo.update("nonexistent", {
        severity: "info",
      });
      expect(result).toBeNull();
    });
  });

  describe("remove", () => {
    it("removes a finding", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      await reviewFindingsRepo.remove("f-1");

      const result = await reviewFindingsRepo.findById("f-1");
      expect(result).toBeNull();
    });
  });
});
