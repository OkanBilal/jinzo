import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createProvider } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

vi.mock("./adapters", () => ({
  listModelsForProvider: vi.fn().mockResolvedValue([{ id: "gpt-4", name: "GPT-4" }]),
  listCommandsForProvider: vi.fn().mockResolvedValue([{ id: "run", name: "Run" }]),
  listSkillsForProvider: vi.fn().mockResolvedValue([{ id: "code", name: "Code" }]),
  invalidateWorkAdapter: vi.fn(),
}));

// Import after mocks
const { providersController } = await import("./providers.controller");

describe("providersController", () => {
  beforeEach(() => {
    const result = createTestDb();
    db = result.db;
    _sqlite = result.sqlite;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  // ── getAll ──────────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no providers exist", async () => {
      const res = await providersController.getAll();
      assertOk(res);
      expect(res.data).toEqual([]);
    });

    it("returns all providers", async () => {
      createProvider(db, { id: "copilot_cli", displayName: "Copilot" });
      createProvider(db, { id: "claude_code", displayName: "Claude", kind: "agent_runtime" });

      const res = await providersController.getAll();
      assertOk(res);
      expect(res.data).toHaveLength(2);
    });
  });

  // ── getById ─────────────────────────────────────────────────
  describe("getById", () => {
    it("returns provider when found", async () => {
      createProvider(db, { id: "copilot_cli", displayName: "Copilot" });

      const res = await providersController.getById("copilot_cli");
      assertOk(res);
      expect(res.data!.id).toBe("copilot_cli");
      expect(res.data!.displayName).toBe("Copilot");
    });

    it("returns error when not found", async () => {
      const res = await providersController.getById("nonexistent");
      assertFail(res);
      expect(res.error).toBeDefined();
    });
  });

  // ── getByKind ───────────────────────────────────────────────
  describe("getByKind", () => {
    it("filters providers by kind", async () => {
      createProvider(db, { id: "p1", kind: "agent_runtime", displayName: "Agent" });
      createProvider(db, { id: "p2", kind: "llm_runtime", displayName: "LLM" });

      const res = await providersController.getByKind("agent_runtime");
      assertOk(res);
      expect(res.data).toHaveLength(1);
      expect(res.data![0].id).toBe("p1");
    });
  });

  // ── getEnabled ──────────────────────────────────────────────
  describe("getEnabled", () => {
    it("returns only enabled providers", async () => {
      createProvider(db, { id: "p1", isEnabled: true, displayName: "Enabled" });
      createProvider(db, { id: "p2", isEnabled: false, displayName: "Disabled" });

      const res = await providersController.getEnabled();
      assertOk(res);
      expect(res.data).toHaveLength(1);
      expect(res.data![0].id).toBe("p1");
    });
  });

  // ── create ──────────────────────────────────────────────────
  describe("create", () => {
    it("creates a new provider", async () => {
      const res = await providersController.create({
        id: "new_provider",
        kind: "agent_runtime",
        displayName: "New Provider",
      });
      assertOk(res);
      expect(res.data).toBe("new_provider");

      const fetched = await providersController.getById("new_provider");
      assertOk(fetched);
      expect(fetched.data!.displayName).toBe("New Provider");
    });

    it("returns error for duplicate id", async () => {
      createProvider(db, { id: "dup", displayName: "Original" });

      const res = await providersController.create({
        id: "dup",
        kind: "agent_runtime",
        displayName: "Duplicate",
      });
      assertFail(res);
      expect(res.error).toContain("already exists");
    });
  });

  // ── update ──────────────────────────────────────────────────
  describe("update", () => {
    it("updates an existing provider", async () => {
      createProvider(db, { id: "p1", displayName: "Old Name" });

      const res = await providersController.update("p1", { displayName: "New Name" });
      assertOk(res);
      expect(res.data!.displayName).toBe("New Name");
    });

    it("returns error when provider not found", async () => {
      const res = await providersController.update("nonexistent", { displayName: "X" });
      assertFail(res);
    });
  });

  // ── delete ──────────────────────────────────────────────────
  describe("delete", () => {
    it("deletes an existing provider", async () => {
      createProvider(db, { id: "p1" });

      const res = await providersController.delete("p1");
      assertOk(res);

      const fetched = await providersController.getById("p1");
      assertFail(fetched);
    });
  });

  // ── enable / disable ───────────────────────────────────────
  describe("enable", () => {
    it("enables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const res = await providersController.enable("p1");
      assertOk(res);

      const fetched = await providersController.getById("p1");
      assertOk(fetched);
      expect(fetched.data.isEnabled).toBe(true);
    });
  });

  describe("disable", () => {
    it("disables a provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const res = await providersController.disable("p1");
      assertOk(res);

      const fetched = await providersController.getById("p1");
      assertOk(fetched);
      expect(fetched.data.isEnabled).toBe(false);
    });
  });

  // ── getModels ───────────────────────────────────────────────
  describe("getModels", () => {
    it("returns models for an enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const res = await providersController.getModels("p1");
      assertOk(res);
      expect(res.data).toEqual([{ id: "gpt-4", name: "GPT-4" }]);
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const res = await providersController.getModels("p1");
      assertFail(res);
      expect(res.error).toContain("not enabled");
    });

    it("returns error for nonexistent provider", async () => {
      const res = await providersController.getModels("nonexistent");
      assertFail(res);
    });
  });

  // ── getCommands ─────────────────────────────────────────────
  describe("getCommands", () => {
    it("returns commands for an enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const res = await providersController.getCommands("p1");
      assertOk(res);
      expect(res.data).toEqual([{ id: "run", name: "Run" }]);
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const res = await providersController.getCommands("p1");
      assertFail(res);
    });
  });

  // ── getSkills ───────────────────────────────────────────────
  describe("getSkills", () => {
    it("returns skills for an enabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const res = await providersController.getSkills("p1");
      assertOk(res);
      expect(res.data).toEqual([{ id: "code", name: "Code" }]);
    });

    it("accepts optional workspacePath", async () => {
      createProvider(db, { id: "p1", isEnabled: true });

      const res = await providersController.getSkills("p1", "/some/path");
      assertOk(res);
      expect(res.data).toEqual([{ id: "code", name: "Code" }]);
    });

    it("returns error for disabled provider", async () => {
      createProvider(db, { id: "p1", isEnabled: false });

      const res = await providersController.getSkills("p1");
      assertFail(res);
    });
  });
});
