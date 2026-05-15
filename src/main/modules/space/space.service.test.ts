import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
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

vi.mock("nanoid", () => ({
  nanoid: () => "mock-nanoid-id",
}));

import { spaceService } from "./space.service";
import { spaceRepo } from "./space.repo";
import * as validation from "./space.validation";

describe("spaceService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getAll", () => {
    it("returns empty list when no spaces", async () => {
      const result = await spaceService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all spaces", async () => {
      createSpace(db, { accountId: "default", name: "A" });
      createSpace(db, { accountId: "default", name: "B" });

      const result = await spaceService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getById", () => {
    it("returns error when not found", async () => {
      const result = await spaceService.getById("nonexistent");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Space not found");
      }
    });

    it("returns space when found", async () => {
      const space = createSpace(db, { accountId: "default", name: "My Space" });

      const result = await spaceService.getById(space.id);
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("My Space");
      }
    });
  });

  describe("create", () => {
    it("creates space with generated slug", async () => {
      const result = await spaceService.create({ name: "Hello World" });
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("Hello World");
        expect(result.data.slug).toBe("hello-world");
      }
    });

    it("rejects duplicate slug", async () => {
      createSpace(db, { accountId: "default", slug: "coding" });

      const result = await spaceService.create({
        name: "Coding",
        slug: "coding",
      });
      assertFail(result);
    });

    it("rejects when name is missing", async () => {
      const result = await spaceService.create({});
      assertFail(result);
    });

    it("rejects invalid payload types", async () => {
      const result = await spaceService.create({ name: 123 });
      assertFail(result);
    });

    it("auto-increments sortOrder", async () => {
      createSpace(db, { accountId: "default", sortOrder: 5 });

      const result = await spaceService.create({ name: "New Space" });
      assertOk(result);
      if (result.success) {
        expect(result.data.sortOrder).toBe(6);
      }
    });
  });

  describe("update", () => {
    it("updates space name", async () => {
      const space = createSpace(db, { accountId: "default", name: "Old" });

      const result = await spaceService.update(space.id, { name: "New" });
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("New");
      }
    });

    it("returns error when space not found", async () => {
      const result = await spaceService.update("nonexistent", { name: "X" });
      assertFail(result);
    });

    it("rejects duplicate slug on update", async () => {
      createSpace(db, { accountId: "default", slug: "taken" });
      const space = createSpace(db, { accountId: "default", slug: "mine" });

      const result = await spaceService.update(space.id, { slug: "taken" });
      assertFail(result);
    });
  });

  describe("delete", () => {
    it("deletes existing space", async () => {
      const space = createSpace(db, { accountId: "default" });

      const result = await spaceService.delete(space.id);
      assertOk(result);
    });

    it("returns error when not found", async () => {
      const result = await spaceService.delete("nonexistent");
      assertFail(result);
    });
  });

  describe("archive", () => {
    it("archives existing space", async () => {
      const space = createSpace(db, { accountId: "default" });

      const result = await spaceService.archive(space.id);
      assertOk(result);
    });

    it("returns error when not found", async () => {
      const result = await spaceService.archive("nonexistent");
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create - additional edge cases
  // ─────────────────────────────────────────────────────────────
  describe("create - edge cases", () => {
    it("creates space with all optional fields", async () => {
      const result = await spaceService.create({
        name: "Full Space",
        description: "A description",
        systemPrompt: "You are helpful",
        model: "claude-opus-4-6",
        icon: "rocket",
        themeConfig: '{"color":"blue"}',
        uiConfig: '{"sidebar":true}',
        sortOrder: 42,
      });
      assertOk(result);
      if (result.success) {
        expect(result.data.description).toBe("A description");
        expect(result.data.model).toBe("claude-opus-4-6");
        expect(result.data.icon).toBe("rocket");
        expect(result.data.sortOrder).toBe(42);
      }
    });

    it("rejects invalid themeConfig JSON", async () => {
      const result = await spaceService.create({
        name: "Bad Theme",
        themeConfig: "not-json",
      });
      assertFail(result);
    });

    it("rejects invalid uiConfig JSON", async () => {
      const result = await spaceService.create({
        name: "Bad UI",
        uiConfig: "{broken",
      });
      assertFail(result);
    });

    it("rejects null payload", async () => {
      const result = await spaceService.create(null);
      assertFail(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update - additional edge cases
  // ─────────────────────────────────────────────────────────────
  describe("update - edge cases", () => {
    it("updates slug auto-generated from new name", async () => {
      const space = createSpace(db, { accountId: "default", name: "Old Name", slug: "old-name" });

      const result = await spaceService.update(space.id, { name: "New Name" });
      assertOk(result);
      if (result.success) {
        expect(result.data.slug).toBe("new-name");
      }
    });

    it("rejects invalid payload on update", async () => {
      const space = createSpace(db, { accountId: "default" });

      const result = await spaceService.update(space.id, null);
      assertFail(result);
    });

    it("updates without providing slug uses name to generate slug", async () => {
      const space = createSpace(db, { accountId: "default", name: "Keep", slug: "keep" });

      // Provide name but no slug - slug should be auto-generated from name
      const result = await spaceService.update(space.id, { name: "Keep", description: "New desc" });
      assertOk(result);
      if (result.success) {
        expect(result.data.description).toBe("New desc");
      }
    });

    it("updates with no name and no slug passes undefined for slug", async () => {
      const space = createSpace(db, { accountId: "default", name: "Original", slug: "original" });

      // Use spyOn to bypass validation and provide data with no name and no slug
      const spy = vi.spyOn(validation, "sanitizeSpacePayload").mockReturnValueOnce({
        data: { description: "only desc" },
        errors: {},
      });

      const result = await spaceService.update(space.id, { description: "only desc" });
      assertOk(result);
      if (result.success) {
        expect(result.data.name).toBe("Original"); // name unchanged
      }
      spy.mockRestore();
    });

    it("allows changing slug to a new unique value", async () => {
      const space = createSpace(db, { accountId: "default", slug: "old-slug", name: "My Space" });

      const result = await spaceService.update(space.id, { slug: "brand-new-slug", name: "My Space" });
      assertOk(result);
      if (result.success) {
        expect(result.data.slug).toBe("brand-new-slug");
      }
    });

    it("rejects duplicate slug on update with explicit error message", async () => {
      createSpace(db, { accountId: "default", slug: "existing-slug", name: "Existing" });
      const space = createSpace(db, { accountId: "default", slug: "my-slug", name: "My Space" });

      const result = await spaceService.update(space.id, { slug: "existing-slug", name: "My Space" });
      assertFail(result);
      expect(result.error).toBe("slug: A space with this slug already exists");
    });

    it("allows same slug when not changing it", async () => {
      const space = createSpace(db, { accountId: "default", name: "Test", slug: "test" });

      const result = await spaceService.update(space.id, { name: "Test Updated", slug: "test" });
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling - catch blocks with Error instances
  // ─────────────────────────────────────────────────────────────
  describe("error handling - Error instances", () => {
    it("getAll catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findAll").mockRejectedValueOnce(new Error("db failure"));
      const result = await spaceService.getAll();
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("db failure");
      }
      spy.mockRestore();
    });

    it("getById catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(new Error("db read error"));
      const result = await spaceService.getById("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("db read error");
      }
      spy.mockRestore();
    });

    it("create catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findBySlug").mockRejectedValueOnce(new Error("slug check failed"));
      const result = await spaceService.create({ name: "Test" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("slug check failed");
      }
      spy.mockRestore();
    });

    it("update catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(new Error("update db error"));
      const result = await spaceService.update("some-id", { name: "X" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("update db error");
      }
      spy.mockRestore();
    });

    it("delete catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(new Error("delete db error"));
      const result = await spaceService.delete("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("delete db error");
      }
      spy.mockRestore();
    });

    it("archive catches Error and returns message", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(new Error("archive db error"));
      const result = await spaceService.archive("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("archive db error");
      }
      spy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling - non-Error thrown values (Unknown error)
  // ─────────────────────────────────────────────────────────────
  describe("error handling - non-Error thrown values", () => {
    it("getAll returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findAll").mockRejectedValueOnce("string error");
      const result = await spaceService.getAll();
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });

    it("getById returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(42);
      const result = await spaceService.getById("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });

    it("create returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findBySlug").mockRejectedValueOnce(null);
      const result = await spaceService.create({ name: "Test" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });

    it("update returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(undefined);
      const result = await spaceService.update("some-id", { name: "X" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });

    it("delete returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce("boom");
      const result = await spaceService.delete("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });

    it("archive returns Unknown error for non-Error throw", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce("boom");
      const result = await spaceService.archive("some-id");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Unknown error");
      }
      spy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge case: findById returns null after create/update
  // ─────────────────────────────────────────────────────────────
  describe("post-write findById failure", () => {
    it("create returns error when findById returns null after insert", async () => {
      const findByIdSpy = vi.spyOn(spaceRepo, "findById").mockResolvedValueOnce(undefined);
      const result = await spaceService.create({ name: "Ghost Space" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to create space");
      }
      findByIdSpy.mockRestore();
    });

    it("create returns name required when sanitize passes but data.name is falsy", async () => {
      // Mock sanitizeSpacePayload to return no errors but also no name
      const spy = vi.spyOn(validation, "sanitizeSpacePayload").mockReturnValueOnce({
        data: {},
        errors: {},
      });
      const result = await spaceService.create({ name: "anything" });
      assertFail(result);
      expect(result.error).toBe("name: Name is required");
      spy.mockRestore();
    });

    it("update returns error when findById returns null after update", async () => {
      const space = createSpace(db, { accountId: "default", name: "Exists" });

      // First call returns the existing space, second call (after update) returns undefined
      const findByIdSpy = vi.spyOn(spaceRepo, "findById")
        .mockResolvedValueOnce(space as any)
        .mockResolvedValueOnce(undefined);

      const result = await spaceService.update(space.id, { name: "Updated" });
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Failed to update space");
      }
      findByIdSpy.mockRestore();
    });
  });
});
