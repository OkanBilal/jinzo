import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
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

import { reviewFindingsController } from "./reviewFindings.controller";

describe("reviewFindingsController", () => {
  let workspaceId: string;
  let reviewId: string;

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    const ws = createWorkspace(db, {});
    workspaceId = ws.id;
    const review = createReview(db, { workspaceId, title: "Test Review" });
    reviewId = review.id;
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByWorkspace", () => {
    it("returns empty array when no findings exist", async () => {
      const result = await reviewFindingsController.getByWorkspace(workspaceId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns findings for a workspace", async () => {
      createReviewFinding(db, { reviewId, message: "Finding 1" });
      createReviewFinding(db, { reviewId, message: "Finding 2" });

      const result = await reviewFindingsController.getByWorkspace(workspaceId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getByReview", () => {
    it("returns empty array when no findings exist for review", async () => {
      const result = await reviewFindingsController.getByReview(reviewId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns findings for a review", async () => {
      createReviewFinding(db, { reviewId, message: "Finding A" });
      createReviewFinding(db, { reviewId, message: "Finding B" });

      const result = await reviewFindingsController.getByReview(reviewId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("respects limit parameter", async () => {
      createReviewFinding(db, { reviewId, message: "F1" });
      createReviewFinding(db, { reviewId, message: "F2" });
      createReviewFinding(db, { reviewId, message: "F3" });

      const result = await reviewFindingsController.getByReview(reviewId, 2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getById", () => {
    it("returns a finding by id", async () => {
      const finding = createReviewFinding(db, {
        reviewId,
        message: "Specific finding",
        severity: "critical",
        file: "src/app.ts",
      });

      const result = await reviewFindingsController.getById(finding.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.id).toBe(finding.id);
        expect(result.data!.message).toBe("Specific finding");
        expect(result.data!.severity).toBe("critical");
      }
    });

    it("returns error for non-existent finding", async () => {
      const result = await reviewFindingsController.getById("non-existent-id");
      expect(result.success).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a new finding and returns its id", async () => {
      const result = await reviewFindingsController.create({
        reviewId,
        severity: "warning",
        file: "src/index.ts",
        message: "Unused variable",
        reason: "Variable declared but never used",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe("string");
        expect(result.data!.length).toBeGreaterThan(0);
      }
    });

    it("creates a finding with suggestion and returns its id", async () => {
      const result = await reviewFindingsController.create({
        reviewId,
        severity: "info",
        file: "src/utils.ts",
        message: "Consider refactoring",
        reason: "Function is too long",
        suggestion: "Split into smaller functions",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Verify via getById
        const fetched = await reviewFindingsController.getById(result.data!);
        expect(fetched.success).toBe(true);
        if (fetched.success) {
          expect(fetched.data!.suggestion).toBe("Split into smaller functions");
        }
      }
    });
  });

  describe("createMany", () => {
    it("creates multiple findings at once", async () => {
      const result = await reviewFindingsController.createMany([
        {
          reviewId,
          severity: "critical",
          file: "src/a.ts",
          message: "Bug found",
          reason: "Null pointer",
        },
        {
          reviewId,
          severity: "warning",
          file: "src/b.ts",
          message: "Code smell",
          reason: "Duplicated logic",
        },
      ]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("update", () => {
    it("updates an existing finding", async () => {
      const finding = createReviewFinding(db, {
        reviewId,
        severity: "warning",
        file: "src/old.ts",
      });

      const result = await reviewFindingsController.update(finding.id, {
        severity: "critical",
        file: "src/new.ts",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.severity).toBe("critical");
        expect(result.data!.file).toBe("src/new.ts");
      }
    });

    it("returns error for non-existent finding", async () => {
      const result = await reviewFindingsController.update("non-existent-id", {
        severity: "info",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete", () => {
    it("deletes an existing finding", async () => {
      const finding = createReviewFinding(db, { reviewId });

      const result = await reviewFindingsController.delete(finding.id);
      expect(result.success).toBe(true);
    });

    it("succeeds silently for non-existent finding", async () => {
      const result = await reviewFindingsController.delete("non-existent-id");
      expect(result.success).toBe(true);
    });
  });
});
