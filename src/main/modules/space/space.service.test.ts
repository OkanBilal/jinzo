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

// Throw-style service: tests assert plain values and rejections — the
// ServiceResponse envelope only exists at the IPC seam (handle()). Reads
// return null for absence; mutations on a missing target throw.

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
      expect(await spaceService.getAll()).toEqual([]);
    });

    it("returns all spaces", async () => {
      createSpace(db, { accountId: "default", name: "A" });
      createSpace(db, { accountId: "default", name: "B" });

      expect(await spaceService.getAll()).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns null when not found (absence rule)", async () => {
      expect(await spaceService.getById("nonexistent")).toBeNull();
    });

    it("returns space when found", async () => {
      const space = createSpace(db, { accountId: "default", name: "My Space" });

      const found = await spaceService.getById(space.id);
      expect(found?.name).toBe("My Space");
    });
  });

  describe("create", () => {
    it("creates space with generated slug", async () => {
      const space = await spaceService.create({ name: "Hello World" });
      expect(space.name).toBe("Hello World");
      expect(space.slug).toBe("hello-world");
    });

    it("rejects duplicate slug", async () => {
      createSpace(db, { accountId: "default", slug: "coding" });

      await expect(
        spaceService.create({ name: "Coding", slug: "coding" }),
      ).rejects.toThrow("slug: A space with this slug already exists");
    });

    it("rejects when name is missing", async () => {
      await expect(spaceService.create({})).rejects.toThrow();
    });

    it("rejects invalid payload types", async () => {
      await expect(spaceService.create({ name: 123 })).rejects.toThrow();
    });

    it("auto-increments sortOrder", async () => {
      createSpace(db, { accountId: "default", sortOrder: 5 });

      const space = await spaceService.create({ name: "New Space" });
      expect(space.sortOrder).toBe(6);
    });
  });

  describe("update", () => {
    it("updates space name", async () => {
      const space = createSpace(db, { accountId: "default", name: "Old" });

      const updated = await spaceService.update(space.id, { name: "New" });
      expect(updated.name).toBe("New");
    });

    it("throws when space not found", async () => {
      await expect(
        spaceService.update("nonexistent", { name: "X" }),
      ).rejects.toThrow("Space not found");
    });

    it("rejects duplicate slug on update", async () => {
      createSpace(db, { accountId: "default", slug: "taken", name: "Taken" });
      const space = createSpace(db, { accountId: "default", slug: "mine", name: "Mine" });

      await expect(
        spaceService.update(space.id, { slug: "taken" }),
      ).rejects.toThrow("slug: A space with this slug already exists");
    });
  });

  describe("delete", () => {
    it("deletes existing space", async () => {
      const space = createSpace(db, { accountId: "default" });

      await spaceService.delete(space.id);
      expect(await spaceService.getById(space.id)).toBeNull();
    });

    it("throws when not found", async () => {
      await expect(spaceService.delete("nonexistent")).rejects.toThrow(
        "Space not found",
      );
    });
  });

  describe("archive", () => {
    it("archives existing space", async () => {
      const space = createSpace(db, { accountId: "default" });

      await expect(spaceService.archive(space.id)).resolves.toBeUndefined();
    });

    it("throws when not found", async () => {
      await expect(spaceService.archive("nonexistent")).rejects.toThrow(
        "Space not found",
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create - additional edge cases
  // ─────────────────────────────────────────────────────────────
  describe("create - edge cases", () => {
    it("creates space with all optional fields", async () => {
      const space = await spaceService.create({
        name: "Full Space",
        description: "A description",
        systemPrompt: "You are helpful",
        model: "claude-opus-4-6",
        icon: "rocket",
        themeConfig: '{"color":"blue"}',
        uiConfig: '{"sidebar":true}',
        sortOrder: 42,
      });
      expect(space.description).toBe("A description");
      expect(space.model).toBe("claude-opus-4-6");
      expect(space.icon).toBe("rocket");
      expect(space.sortOrder).toBe(42);
    });

    it("rejects invalid themeConfig JSON", async () => {
      await expect(
        spaceService.create({ name: "Bad Theme", themeConfig: "not-json" }),
      ).rejects.toThrow();
    });

    it("rejects invalid uiConfig JSON", async () => {
      await expect(
        spaceService.create({ name: "Bad UI", uiConfig: "{broken" }),
      ).rejects.toThrow();
    });

    it("rejects null payload", async () => {
      await expect(spaceService.create(null)).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update - additional edge cases
  // ─────────────────────────────────────────────────────────────
  describe("update - edge cases", () => {
    it("updates slug auto-generated from new name", async () => {
      const space = createSpace(db, { accountId: "default", name: "Old Name", slug: "old-name" });

      const updated = await spaceService.update(space.id, { name: "New Name" });
      expect(updated.slug).toBe("new-name");
    });

    it("rejects invalid payload on update", async () => {
      const space = createSpace(db, { accountId: "default" });

      await expect(spaceService.update(space.id, null)).rejects.toThrow();
    });

    it("updates without providing slug uses name to generate slug", async () => {
      const space = createSpace(db, { accountId: "default", name: "Keep", slug: "keep" });

      // Provide name but no slug - slug should be auto-generated from name
      const updated = await spaceService.update(space.id, {
        name: "Keep",
        description: "New desc",
      });
      expect(updated.description).toBe("New desc");
    });

    it("updates with no name and no slug passes undefined for slug", async () => {
      const space = createSpace(db, { accountId: "default", name: "Original", slug: "original" });

      // Use spyOn to bypass validation and provide data with no name and no slug
      const spy = vi.spyOn(validation, "sanitizeSpacePayload").mockReturnValueOnce({
        data: { description: "only desc" },
        errors: {},
      });

      const updated = await spaceService.update(space.id, {
        description: "only desc",
      });
      expect(updated.name).toBe("Original"); // name unchanged
      spy.mockRestore();
    });

    it("allows changing slug to a new unique value", async () => {
      const space = createSpace(db, { accountId: "default", slug: "old-slug", name: "My Space" });

      const updated = await spaceService.update(space.id, {
        slug: "brand-new-slug",
        name: "My Space",
      });
      expect(updated.slug).toBe("brand-new-slug");
    });

    it("allows same slug when not changing it", async () => {
      const space = createSpace(db, { accountId: "default", name: "Test", slug: "test" });

      await expect(
        spaceService.update(space.id, { name: "Test Updated", slug: "test" }),
      ).resolves.toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error propagation
  // ─────────────────────────────────────────────────────────────
  describe("error propagation", () => {
    it("getAll propagates repo failures", async () => {
      const spy = vi.spyOn(spaceRepo, "findAll").mockRejectedValueOnce(new Error("db failure"));
      await expect(spaceService.getAll()).rejects.toThrow("db failure");
      spy.mockRestore();
    });

    it("create propagates repo failures", async () => {
      const spy = vi.spyOn(spaceRepo, "findBySlug").mockRejectedValueOnce(new Error("slug check failed"));
      await expect(spaceService.create({ name: "Test" })).rejects.toThrow(
        "slug check failed",
      );
      spy.mockRestore();
    });

    it("update propagates repo failures", async () => {
      const spy = vi.spyOn(spaceRepo, "findById").mockRejectedValueOnce(new Error("update db error"));
      await expect(spaceService.update("some-id", { name: "X" })).rejects.toThrow(
        "update db error",
      );
      spy.mockRestore();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge case: findById returns null after create/update
  // ─────────────────────────────────────────────────────────────
  describe("post-write findById failure", () => {
    it("create throws when findById returns null after insert", async () => {
      const findByIdSpy = vi.spyOn(spaceRepo, "findById").mockResolvedValueOnce(undefined);
      await expect(spaceService.create({ name: "Ghost Space" })).rejects.toThrow(
        "Failed to create space",
      );
      findByIdSpy.mockRestore();
    });

    it("create throws name required when sanitize passes but data.name is falsy", async () => {
      // Mock sanitizeSpacePayload to return no errors but also no name
      const spy = vi.spyOn(validation, "sanitizeSpacePayload").mockReturnValueOnce({
        data: {},
        errors: {},
      });
      await expect(spaceService.create({ name: "anything" })).rejects.toThrow(
        "name: Name is required",
      );
      spy.mockRestore();
    });

    it("update throws when findById returns null after update", async () => {
      const space = createSpace(db, { accountId: "default", name: "Exists" });

      // First call returns the existing space, second call (after update) returns undefined
      const findByIdSpy = vi.spyOn(spaceRepo, "findById")
        .mockResolvedValueOnce(space as any)
        .mockResolvedValueOnce(undefined);

      await expect(
        spaceService.update(space.id, { name: "Updated" }),
      ).rejects.toThrow("Failed to update space");
      findByIdSpy.mockRestore();
    });
  });
});
