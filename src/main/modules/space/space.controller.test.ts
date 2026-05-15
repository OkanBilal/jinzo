import { assertOk, assertFail } from "./space.dto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createSpace } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { spaceController } from "./space.controller";

describe("spaceController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getAll", () => {
    it("returns empty array when no spaces exist", async () => {
      const result = await spaceController.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all spaces", async () => {
      createSpace(db, { name: "Space A" });
      createSpace(db, { name: "Space B" });

      const result = await spaceController.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getById", () => {
    it("returns a space by id", async () => {
      const space = createSpace(db, { name: "My Space" });

      const result = await spaceController.getById(space.id);
      assertOk(result);
      if (result.success) {
        expect(result.data.id).toBe(space.id);
        expect(result.data.name).toBe("My Space");
      }
    });

    it("returns error for non-existent space", async () => {
      const result = await spaceController.getById("non-existent-id");
      assertFail(result);
    });
  });

  describe("create", () => {
    it("creates a new space", async () => {
      const result = await spaceController.create({
        name: "New Space",
        slug: "new-space",
      });
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("New Space");
        expect(result.data.slug).toBe("new-space");
      }
    });

    it("returns error for invalid payload", async () => {
      const result = await spaceController.create(null);
      assertFail(result);
    });

    it("returns error for missing name", async () => {
      const result = await spaceController.create({ slug: "no-name" });
      assertFail(result);
    });
  });

  describe("update", () => {
    it("updates an existing space", async () => {
      const space = createSpace(db, { name: "Old Name" });

      const result = await spaceController.update(space.id, {
        name: "Updated Name",
      });
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("Updated Name");
      }
    });

    it("returns error for invalid payload", async () => {
      const space = createSpace(db, {});
      const result = await spaceController.update(space.id, null);
      assertFail(result);
    });
  });

  describe("delete", () => {
    it("deletes an existing space", async () => {
      const space = createSpace(db, { name: "To Delete" });

      const result = await spaceController.delete(space.id);
      assertOk(result);
    });

    it("returns error for non-existent space", async () => {
      const result = await spaceController.delete("non-existent-id");
      assertFail(result);
    });
  });

  describe("archive", () => {
    it("archives an existing space", async () => {
      const space = createSpace(db, { name: "To Archive" });

      const result = await spaceController.archive(space.id);
      assertOk(result);

      // Verify the space is now archived via getById
      const fetched = await spaceController.getById(space.id);
      assertOk(fetched);
      if (fetched.success) {
        expect(fetched.data.isArchived).toBe(true);
      }
    });

    it("returns error for non-existent space", async () => {
      const result = await spaceController.archive("non-existent-id");
      assertFail(result);
    });
  });
});
