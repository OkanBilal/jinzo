import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createRun,
  createProvider,
  createToolCall,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { toolsService } from "./tools.service";
import { toolsRepo } from "./tools.repo";

describe("toolsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createProvider(db, { id: "copilot_cli" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getToolCallsByRun", () => {
    it("returns tool calls for run", async () => {
      const run = createRun(db, { id: "run-1" });
      createToolCall(db, { runId: run.id, toolName: "Bash" });

      const result = await toolsService.getToolCallsByRun("run-1");
      expect(result.success).toBe(true);
      expect(result.data!).toHaveLength(1);
    });

    it("returns empty for run with no tool calls", async () => {
      const result = await toolsService.getToolCallsByRun("run-empty");
      expect(result.success).toBe(true);
      expect(result.data!).toEqual([]);
    });
  });

  describe("getToolCallsByAccount", () => {
    it("returns tool calls for account", async () => {
      const run = createRun(db, { id: "run-1" });
      createToolCall(db, { accountId: "default", runId: run.id, toolName: "Read" });

      const result = await toolsService.getToolCallsByAccount("default");
      expect(result.success).toBe(true);
      expect(result.data!).toHaveLength(1);
    });
  });

  describe("createToolCall", () => {
    it("creates a tool call and returns id", async () => {
      const result = await toolsService.createToolCall({
        accountId: "default",
        toolName: "Bash",
      });
      expect(result.success).toBe(true);
      expect(typeof result.data!).toBe("number");
      expect(result.data!).toBeGreaterThan(0);
    });
  });

  describe("updateToolCall", () => {
    it("updates tool call status", async () => {
      const run = createRun(db, { id: "run-1" });
      const tc = createToolCall(db, { runId: run.id, toolName: "Bash" });

      const result = await toolsService.updateToolCall(tc.id, {
        status: "running",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("startToolCall", () => {
    it("sets status to running and startedAt", async () => {
      const run = createRun(db, { id: "run-1" });
      const tc = createToolCall(db, { runId: run.id, toolName: "Bash" });

      const result = await toolsService.startToolCall(tc.id);
      expect(result.success).toBe(true);

      const calls = await toolsRepo.findToolCallsByRun("run-1");
      expect(calls[0].status).toBe("running");
      expect(calls[0].startedAt).not.toBeNull();
    });
  });

  describe("completeToolCall", () => {
    it("sets status to done with output", async () => {
      const run = createRun(db, { id: "run-1" });
      const tc = createToolCall(db, { runId: run.id, toolName: "Bash" });

      const result = await toolsService.completeToolCall(
        tc.id,
        { stdout: "hello" },
        120,
      );
      expect(result.success).toBe(true);

      const calls = await toolsRepo.findToolCallsByRun("run-1");
      expect(calls[0].status).toBe("done");
      expect(calls[0].output).toEqual({ stdout: "hello" });
      expect(calls[0].latencyMs).toBe(120);
      expect(calls[0].endedAt).not.toBeNull();
    });
  });

  describe("failToolCall", () => {
    it("sets status to error with error message", async () => {
      const run = createRun(db, { id: "run-1" });
      const tc = createToolCall(db, { runId: run.id, toolName: "Bash" });

      const result = await toolsService.failToolCall(tc.id, "Command failed");
      expect(result.success).toBe(true);

      const calls = await toolsRepo.findToolCallsByRun("run-1");
      expect(calls[0].status).toBe("error");
      expect(calls[0].error).toBe("Command failed");
      expect(calls[0].endedAt).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getToolCallsByRun returns error on failure", async () => {
      vi.spyOn(toolsRepo, "findToolCallsByRun").mockRejectedValueOnce(new Error("db error"));
      const result = await toolsService.getToolCallsByRun("r1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get tool calls");
    });

    it("getToolCallsByAccount returns error on failure", async () => {
      vi.spyOn(toolsRepo, "findToolCallsByAccount").mockRejectedValueOnce(new Error("db error"));
      const result = await toolsService.getToolCallsByAccount("a1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get tool calls");
    });

    it("createToolCall returns error on failure", async () => {
      vi.spyOn(toolsRepo, "insertToolCall").mockRejectedValueOnce(new Error("db error"));
      const result = await toolsService.createToolCall({ accountId: "default", toolName: "X" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create tool call");
    });

    it("updateToolCall returns error on failure", async () => {
      vi.spyOn(toolsRepo, "updateToolCall").mockRejectedValueOnce(new Error("db error"));
      const result = await toolsService.updateToolCall(999, { status: "running" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update tool call");
    });
  });
});
