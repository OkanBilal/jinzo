import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createProvider } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

// Mock adapter functions
vi.mock("./adapters", () => ({
  listModelsForProvider: vi.fn().mockResolvedValue([
    { id: "gpt-4", name: "GPT-4" },
  ]),
  listCommandsForProvider: vi.fn().mockResolvedValue([
    { id: "run", name: "Run" },
  ]),
  listSkillsForProvider: vi.fn().mockResolvedValue([
    { id: "code", name: "Code" },
  ]),
  invalidateWorkAdapter: vi.fn(),
}));

import { providersService } from "./providers.service";

describe("providersService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no providers", async () => {
      const result = await providersService.getAll();
      expect(result).toEqual([]);
    });

    it("returns all providers", async () => {
      createProvider(db, { id: "p1", displayName: "P1" });
      createProvider(db, { id: "p2", displayName: "P2" });

      const result = await providersService.getAll();
      expect(result).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns provider when found", async () => {
      createProvider(db, { id: "p1", displayName: "Provider 1" });

      const result = await providersService.getById("p1");
      expect(result?.displayName).toBe("Provider 1");
    });

    it("returns null when not found (absence rule)", async () => {
      expect(await providersService.getById("nonexistent")).toBeNull();
    });
  });

  describe("getByKind", () => {
    it("returns providers filtered by kind", async () => {
      createProvider(db, { id: "p1", kind: "agent_runtime" });
      createProvider(db, { id: "p2", kind: "llm_runtime" });

      const result = await providersService.getByKind("agent_runtime");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });
  });

  describe("getEnabled", () => {
    it("returns only enabled providers", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      createProvider(db, { id: "p2", isEnabled: false });

      const result = await providersService.getEnabled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });
  });

  describe("create", () => {
    it("creates a new provider", async () => {
      const result = await providersService.create({
        id: "new-provider",
        kind: "agent_runtime",
        displayName: "New Provider",
      });
      expect(result).toBe("new-provider");
    });

    it("returns error if provider already exists", async () => {
      createProvider(db, { id: "p1" });

      await expect(providersService.create({ id: "p1", kind: "agent_runtime", displayName: "Duplicate", })).rejects.toThrow("Provider with this ID already exists");
    });
  });

  describe("update", () => {
    it("updates and returns provider", async () => {
      createProvider(db, { id: "p1", displayName: "Old" });

      const result = await providersService.update("p1", { displayName: "New" });
      expect(result.displayName).toBe("New");
    });

    it("returns error for nonexistent provider", async () => {
      await expect(providersService.update("nonexistent", { displayName: "X" })).rejects.toThrow("Provider not found");
    });
  });

  describe("delete", () => {
    it("deletes a provider", async () => {
      createProvider(db, { id: "p1" });

      await providersService.delete("p1");

      expect(await providersService.getById("p1")).toBeNull();
    });
  });

  describe("enable", () => {
    it("enables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      await providersService.enable("p1");

      const check = await providersService.getById("p1");
      expect(check?.isEnabled).toBe(true);
    });
  });

  describe("disable", () => {
    it("disables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      await providersService.disable("p1");

      const check = await providersService.getById("p1");
      expect(check?.isEnabled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Adapter-backed queries
  // ─────────────────────────────────────────────────────────────
  describe("getModels", () => {
    it("returns models for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getModels("p1");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("gpt-4");
    });

    it("returns error for nonexistent provider", async () => {
      await expect(providersService.getModels("nonexistent")).rejects.toThrow("Provider not found");
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      await expect(providersService.getModels("p1")).rejects.toThrow("Provider is not enabled");
    });
  });

  describe("getCommands", () => {
    it("returns commands for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getCommands("p1");
      expect(result).toHaveLength(1);
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      await expect(providersService.getCommands("p1")).rejects.toThrow("Provider is not enabled");
    });
  });

  describe("getSkills", () => {
    it("returns skills for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getSkills("p1");
      expect(result).toHaveLength(1);
    });

    it("returns error for nonexistent provider", async () => {
      await expect(providersService.getSkills("nonexistent")).rejects.toThrow("Provider not found");
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      await expect(providersService.getSkills("p1")).rejects.toThrow("Provider is not enabled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Missing branch: getCommands nonexistent provider
  // ─────────────────────────────────────────────────────────────
  describe("getCommands (additional)", () => {
    it("returns error for nonexistent provider", async () => {
      await expect(providersService.getCommands("nonexistent")).rejects.toThrow("Provider not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Catch block coverage via repo failures
  // ─────────────────────────────────────────────────────────────
  describe("error handling (catch blocks)", () => {
    it("getAll returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findAll").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.getAll()).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("getById returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findById").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.getById("p1")).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("getByKind returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findByKind").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.getByKind("agent_runtime")).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("getEnabled returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findEnabled").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.getEnabled()).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("create returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findById").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.create({ id: "fail-provider", kind: "agent_runtime", displayName: "Fail", })).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("update returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "update").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.update("p1", { displayName: "X" })).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("delete returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "delete").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.delete("p1")).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("enable returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "setEnabled").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.enable("p1")).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("disable returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "setEnabled").mockRejectedValueOnce(new Error("db error"));

      await expect(providersService.disable("p1")).rejects.toThrow("db error");

      spy.mockRestore();
    });

    it("getModels returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listModelsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listModelsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Model fetch failed"));

      await expect(providersService.getModels("p1")).rejects.toThrow("Model fetch failed");
    });

    it("getModels returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listModelsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listModelsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      await expect(providersService.getModels("p1")).rejects.toBe("string error");
    });

    it("getCommands returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listCommandsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listCommandsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Command fetch failed"));

      await expect(providersService.getCommands("p1")).rejects.toThrow("Command fetch failed");
    });

    it("getCommands returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listCommandsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listCommandsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      await expect(providersService.getCommands("p1")).rejects.toBe("string error");
    });

    it("getSkills returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listSkillsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listSkillsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Skill fetch failed"));

      await expect(providersService.getSkills("p1")).rejects.toThrow("Skill fetch failed");
    });

    it("getSkills returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listSkillsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listSkillsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      await expect(providersService.getSkills("p1")).rejects.toBe("string error");
    });
  });
});
