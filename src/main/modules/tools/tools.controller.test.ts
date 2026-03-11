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

vi.mock("../../db/client", () => ({ getDb: () => db }));

// Import after mock
const { toolsController } = await import("./tools.controller");

describe("toolsController", () => {
  beforeEach(() => {
    const result = createTestDb();
    db = result.db;
    _sqlite = result.sqlite;
    cleanup = result.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  // ── getToolCallsByRun ───────────────────────────────────────
  describe("getToolCallsByRun", () => {
    it("returns empty array when no tool calls exist for run", async () => {
      const run = createRun(db, { id: "run-1" });

      const res = await toolsController.getToolCallsByRun(run.id);
      expect(res.success).toBe(true);
      expect(res.data).toEqual([]);
    });

    it("returns tool calls for a given run", async () => {
      const run = createRun(db, { id: "run-1" });
      createToolCall(db, { runId: run.id, toolName: "Bash" });
      createToolCall(db, { runId: run.id, toolName: "Read" });

      const res = await toolsController.getToolCallsByRun(run.id);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
    });

    it("does not return tool calls from other runs", async () => {
      createRun(db, { id: "run-1" });
      createRun(db, { id: "run-2" });
      createToolCall(db, { runId: "run-1", toolName: "Bash" });
      createToolCall(db, { runId: "run-2", toolName: "Read" });

      const res = await toolsController.getToolCallsByRun("run-1");
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(1);
      expect(res.data![0].toolName).toBe("Bash");
    });
  });

  // ── getToolCallsByAccount ───────────────────────────────────
  describe("getToolCallsByAccount", () => {
    it("returns tool calls for a given account", async () => {
      createAccount(db, { id: "acct-1" });
      createToolCall(db, { accountId: "acct-1", toolName: "Bash" });
      createToolCall(db, { accountId: "acct-1", toolName: "Read" });

      const res = await toolsController.getToolCallsByAccount("acct-1");
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createAccount(db, { id: "acct-1" });
      createToolCall(db, { accountId: "acct-1", toolName: "Bash" });
      createToolCall(db, { accountId: "acct-1", toolName: "Read" });
      createToolCall(db, { accountId: "acct-1", toolName: "Glob" });

      const res = await toolsController.getToolCallsByAccount("acct-1", 2);
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
    });
  });

  // ── createToolCall ──────────────────────────────────────────
  describe("createToolCall", () => {
    it("creates a tool call and returns its id", async () => {
      createAccount(db, { id: "acct-1" });
      const run = createRun(db, { id: "run-1" });

      const res = await toolsController.createToolCall({
        accountId: "acct-1",
        runId: run.id,
        toolName: "Bash",
      });
      expect(res.success).toBe(true);
      expect(typeof res.data).toBe("number");
    });

    it("creates a tool call without runId", async () => {
      createAccount(db, { id: "acct-1" });

      const res = await toolsController.createToolCall({
        accountId: "acct-1",
        toolName: "Read",
      });
      expect(res.success).toBe(true);
      expect(typeof res.data).toBe("number");
    });
  });

  // ── updateToolCall ──────────────────────────────────────────
  describe("updateToolCall", () => {
    it("updates a tool call status", async () => {
      const tc = createToolCall(db, { toolName: "Bash" });

      const res = await toolsController.updateToolCall(tc.id, { status: "running" });
      expect(res.success).toBe(true);
    });
  });

  // ── startToolCall ───────────────────────────────────────────
  describe("startToolCall", () => {
    it("sets tool call status to running", async () => {
      const tc = createToolCall(db, { toolName: "Bash", status: "queued" });

      const res = await toolsController.startToolCall(tc.id);
      expect(res.success).toBe(true);

      // Verify via getToolCallsByAccount
      const calls = await toolsController.getToolCallsByAccount(tc.accountId);
      const updated = calls.data!.find((c) => c.id === tc.id);
      expect(updated!.status).toBe("running");
    });
  });

  // ── completeToolCall ────────────────────────────────────────
  describe("completeToolCall", () => {
    it("marks tool call as done with output", async () => {
      const tc = createToolCall(db, { toolName: "Bash", status: "running" });

      const res = await toolsController.completeToolCall(tc.id, { result: "ok" }, 150);
      expect(res.success).toBe(true);

      const calls = await toolsController.getToolCallsByAccount(tc.accountId);
      const updated = calls.data!.find((c) => c.id === tc.id);
      expect(updated!.status).toBe("done");
      expect(updated!.latencyMs).toBe(150);
    });

    it("completes without latencyMs", async () => {
      const tc = createToolCall(db, { toolName: "Bash", status: "running" });

      const res = await toolsController.completeToolCall(tc.id, { result: "ok" });
      expect(res.success).toBe(true);
    });
  });

  // ── failToolCall ────────────────────────────────────────────
  describe("failToolCall", () => {
    it("marks tool call as error with message", async () => {
      const tc = createToolCall(db, { toolName: "Bash", status: "running" });

      const res = await toolsController.failToolCall(tc.id, "Something broke");
      expect(res.success).toBe(true);

      const calls = await toolsController.getToolCallsByAccount(tc.accountId);
      const updated = calls.data!.find((c) => c.id === tc.id);
      expect(updated!.status).toBe("error");
      expect(updated!.error).toBe("Something broke");
    });
  });
});
