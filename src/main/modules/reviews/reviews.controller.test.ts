import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createWorkspace, createReview } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { reviewsController } from "./reviews.controller";

describe("reviewsController", () => {
  let workspaceId: string;

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    const ws = createWorkspace(db, {});
    workspaceId = ws.id;
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByWorkspace", () => {
    it("returns empty array when no reviews exist", async () => {
      const result = await reviewsController.getByWorkspace(workspaceId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns reviews for a workspace", async () => {
      createReview(db, { workspaceId, title: "Review 1" });
      createReview(db, { workspaceId, title: "Review 2" });

      const result = await reviewsController.getByWorkspace(workspaceId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it("respects limit parameter", async () => {
      createReview(db, { workspaceId, title: "Review 1" });
      createReview(db, { workspaceId, title: "Review 2" });
      createReview(db, { workspaceId, title: "Review 3" });

      const result = await reviewsController.getByWorkspace(workspaceId, 2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getById", () => {
    it("returns a review by id", async () => {
      const review = createReview(db, { workspaceId, title: "My Review" });

      const result = await reviewsController.getById(review.id);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.id).toBe(review.id);
        expect(result.data!.title).toBe("My Review");
      }
    });

    it("returns error for non-existent review", async () => {
      const result = await reviewsController.getById("non-existent-id");
      expect(result.success).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a new review and returns its id", async () => {
      const result = await reviewsController.create({
        workspaceId,
        title: "New Review",
        status: "open",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data).toBe("string");
        expect(result.data!.length).toBeGreaterThan(0);
      }
    });

    it("creates a review with summary and returns its id", async () => {
      const result = await reviewsController.create({
        workspaceId,
        title: "Review with Summary",
        summary: "This is a test summary",
        status: "in_review",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Verify the created review via getById
        const fetched = await reviewsController.getById(result.data!);
        expect(fetched.success).toBe(true);
        if (fetched.success) {
          expect(fetched.data!.summary).toBe("This is a test summary");
          expect(fetched.data!.status).toBe("in_review");
        }
      }
    });
  });

  describe("update", () => {
    it("updates an existing review", async () => {
      const review = createReview(db, { workspaceId, title: "Original", status: "open" });

      const result = await reviewsController.update(review.id, {
        title: "Updated Title",
        status: "approved",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.title).toBe("Updated Title");
        expect(result.data!.status).toBe("approved");
      }
    });

    it("returns error for non-existent review", async () => {
      const result = await reviewsController.update("non-existent-id", {
        title: "Nope",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("delete", () => {
    it("deletes an existing review", async () => {
      const review = createReview(db, { workspaceId, title: "To Delete" });

      const result = await reviewsController.delete(review.id);
      expect(result.success).toBe(true);
    });

    it("succeeds silently for non-existent review", async () => {
      const result = await reviewsController.delete("non-existent-id");
      expect(result.success).toBe(true);
    });
  });
});
