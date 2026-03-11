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
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns all providers", async () => {
      createProvider(db, { id: "p1", displayName: "P1" });
      createProvider(db, { id: "p2", displayName: "P2" });

      const result = await providersService.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns provider when found", async () => {
      createProvider(db, { id: "p1", displayName: "Provider 1" });

      const result = await providersService.getById("p1");
      expect(result.success).toBe(true);
      expect(result.data!.displayName).toBe("Provider 1");
    });

    it("returns error when not found", async () => {
      const result = await providersService.getById("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });
  });

  describe("getByKind", () => {
    it("returns providers filtered by kind", async () => {
      createProvider(db, { id: "p1", kind: "agent_runtime" });
      createProvider(db, { id: "p2", kind: "llm_runtime" });

      const result = await providersService.getByKind("agent_runtime");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("p1");
    });
  });

  describe("getEnabled", () => {
    it("returns only enabled providers", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      createProvider(db, { id: "p2", isEnabled: false });

      const result = await providersService.getEnabled();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("p1");
    });
  });

  describe("create", () => {
    it("creates a new provider", async () => {
      const result = await providersService.create({
        id: "new-provider",
        kind: "agent_runtime",
        displayName: "New Provider",
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe("new-provider");
    });

    it("returns error if provider already exists", async () => {
      createProvider(db, { id: "p1" });

      const result = await providersService.create({
        id: "p1",
        kind: "agent_runtime",
        displayName: "Duplicate",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider with this ID already exists");
    });
  });

  describe("update", () => {
    it("updates and returns provider", async () => {
      createProvider(db, { id: "p1", displayName: "Old" });

      const result = await providersService.update("p1", { displayName: "New" });
      expect(result.success).toBe(true);
      expect(result.data!.displayName).toBe("New");
    });

    it("returns error for nonexistent provider", async () => {
      const result = await providersService.update("nonexistent", { displayName: "X" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });
  });

  describe("delete", () => {
    it("deletes a provider", async () => {
      createProvider(db, { id: "p1" });

      const result = await providersService.delete("p1");
      expect(result.success).toBe(true);

      const check = await providersService.getById("p1");
      expect(check.success).toBe(false);
    });
  });

  describe("enable", () => {
    it("enables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const result = await providersService.enable("p1");
      expect(result.success).toBe(true);

      const check = await providersService.getById("p1");
      expect(check.data!.isEnabled).toBe(true);
    });
  });

  describe("disable", () => {
    it("disables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.disable("p1");
      expect(result.success).toBe(true);

      const check = await providersService.getById("p1");
      expect(check.data!.isEnabled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Adapter-backed queries
  // ─────────────────────────────────────────────────────────────
  describe("getModels", () => {
    it("returns models for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getModels("p1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("gpt-4");
    });

    it("returns error for nonexistent provider", async () => {
      const result = await providersService.getModels("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const result = await providersService.getModels("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider is not enabled");
    });
  });

  describe("getCommands", () => {
    it("returns commands for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getCommands("p1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const result = await providersService.getCommands("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider is not enabled");
    });
  });

  describe("getSkills", () => {
    it("returns skills for enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const result = await providersService.getSkills("p1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns error for nonexistent provider", async () => {
      const result = await providersService.getSkills("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const result = await providersService.getSkills("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider is not enabled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Missing branch: getCommands nonexistent provider
  // ─────────────────────────────────────────────────────────────
  describe("getCommands (additional)", () => {
    it("returns error for nonexistent provider", async () => {
      const result = await providersService.getCommands("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Provider not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Catch block coverage via repo failures
  // ─────────────────────────────────────────────────────────────
  describe("error handling (catch blocks)", () => {
    it("getAll returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findAll").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.getAll();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get providers");

      spy.mockRestore();
    });

    it("getById returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findById").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.getById("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get provider");

      spy.mockRestore();
    });

    it("getByKind returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findByKind").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.getByKind("agent_runtime");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get providers");

      spy.mockRestore();
    });

    it("getEnabled returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findEnabled").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.getEnabled();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get providers");

      spy.mockRestore();
    });

    it("create returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "findById").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.create({
        id: "fail-provider",
        kind: "agent_runtime",
        displayName: "Fail",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create provider");

      spy.mockRestore();
    });

    it("update returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "update").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.update("p1", { displayName: "X" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update provider");

      spy.mockRestore();
    });

    it("delete returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "delete").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.delete("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete provider");

      spy.mockRestore();
    });

    it("enable returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "setEnabled").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.enable("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to enable provider");

      spy.mockRestore();
    });

    it("disable returns error on repo failure", async () => {
      const { providersRepo } = await import("./providers.repo");
      const spy = vi.spyOn(providersRepo, "setEnabled").mockRejectedValueOnce(new Error("db error"));

      const result = await providersService.disable("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to disable provider");

      spy.mockRestore();
    });

    it("getModels returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listModelsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listModelsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Model fetch failed"));

      const result = await providersService.getModels("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Model fetch failed");
    });

    it("getModels returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listModelsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listModelsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      const result = await providersService.getModels("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get models");
    });

    it("getCommands returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listCommandsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listCommandsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Command fetch failed"));

      const result = await providersService.getCommands("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Command fetch failed");
    });

    it("getCommands returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listCommandsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listCommandsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      const result = await providersService.getCommands("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get commands");
    });

    it("getSkills returns error.message when error is an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listSkillsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listSkillsForProvider);
      mockFn.mockRejectedValueOnce(new Error("Skill fetch failed"));

      const result = await providersService.getSkills("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Skill fetch failed");
    });

    it("getSkills returns generic message when error is not an Error instance", async () => {
      createProvider(db, { id: "p1", isEnabled: true });
      const { listSkillsForProvider } = await import("./adapters");
      const mockFn = vi.mocked(listSkillsForProvider);
      mockFn.mockRejectedValueOnce("string error");

      const result = await providersService.getSkills("p1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get skills");
    });
  });
});
