import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createWorkspace, createRun, createReview } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { reviewsRepo } from "./reviews.repo";

describe("reviewsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findByWorkspace", () => {
    it("returns empty array when no reviews", async () => {
      const result = await reviewsRepo.findByWorkspace("ws-1");
      expect(result).toEqual([]);
    });

    it("returns reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "Review 1" });
      createReview(db, { workspaceId: ws.id, title: "Review 2" });
      createReview(db, { workspaceId: "ws-other", title: "Other" });

      const result = await reviewsRepo.findByWorkspace("ws-1");
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      for (let i = 0; i < 5; i++) {
        createReview(db, { workspaceId: ws.id, title: `Review ${i}` });
      }

      const result = await reviewsRepo.findByWorkspace("ws-1", 3);
      expect(result).toHaveLength(3);
    });
  });

  describe("findById", () => {
    it("returns null when not found", async () => {
      const result = await reviewsRepo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns review when found", async () => {
      const review = createReview(db, { id: "r-1", title: "My Review" });

      const result = await reviewsRepo.findById(review.id);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("My Review");
    });

    it("parses metadata JSON", async () => {
      createReview(db, {
        id: "r-meta",
        title: "With Metadata",
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = await reviewsRepo.findById("r-meta");
      expect(result!.metadata).toEqual({ key: "value" });
    });
  });

  describe("insert", () => {
    it("inserts a review and returns id", async () => {
      const id = await reviewsRepo.insert({
        title: "New Review",
      });
      expect(id).toBeDefined();

      const review = await reviewsRepo.findById(id);
      expect(review!.title).toBe("New Review");
      expect(review!.status).toBe("open");
    });

    it("uses provided id", async () => {
      const id = await reviewsRepo.insert({
        id: "custom-id",
        title: "Custom ID Review",
      });
      expect(id).toBe("custom-id");
    });

    it("stores metadata as JSON", async () => {
      const id = await reviewsRepo.insert({
        title: "With Meta",
        metadata: { score: 9 },
      });

      const review = await reviewsRepo.findById(id);
      expect(review!.metadata).toEqual({ score: 9 });
    });

    it("links review to run", async () => {
      const run = createRun(db, { id: "run-1" });
      const id = await reviewsRepo.insert({
        title: "Run Review",
        runId: run.id,
      });

      const review = await reviewsRepo.findById(id);
      expect(review!.runId).toBe("run-1");
    });
  });

  describe("update", () => {
    it("updates title", async () => {
      createReview(db, { id: "r-1", title: "Old" });

      const result = await reviewsRepo.update("r-1", { title: "New" });
      expect(result!.title).toBe("New");
    });

    it("updates status", async () => {
      createReview(db, { id: "r-1", status: "open" });

      const result = await reviewsRepo.update("r-1", { status: "approved" });
      expect(result!.status).toBe("approved");
    });

    it("updates metadata", async () => {
      createReview(db, { id: "r-1" });

      const result = await reviewsRepo.update("r-1", {
        metadata: { notes: "good" },
      });
      expect(result!.metadata).toEqual({ notes: "good" });
    });

    it("returns null when not found", async () => {
      const result = await reviewsRepo.update("nonexistent", { title: "X" });
      expect(result).toBeNull();
    });
  });

  describe("remove", () => {
    it("removes a review", async () => {
      createReview(db, { id: "r-1" });

      await reviewsRepo.remove("r-1");

      const result = await reviewsRepo.findById("r-1");
      expect(result).toBeNull();
    });
  });

  describe("deleteByWorkspaceId", () => {
    it("deletes all reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });
      createReview(db, { workspaceId: "ws-other", title: "Other" });

      await reviewsRepo.deleteByWorkspaceId("ws-1");

      const remaining = await reviewsRepo.findByWorkspace("ws-1");
      expect(remaining).toHaveLength(0);

      // Other workspace reviews remain
      const other = await reviewsRepo.findByWorkspace("ws-other");
      expect(other).toHaveLength(1);
    });
  });
});
