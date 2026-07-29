import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkRunEvent } from "../../../../shared/adapter.types";
import {
  createCodexEventMapper,
  type CodexEventRunState,
} from "./codex-event-mapper";

const tempDirs: string[] = [];

function createRunState(
  rootPath: string | null = null,
): CodexEventRunState {
  return {
    threadId: "thread-parent",
    turnId: null,
    currentMessageItemId: null,
    agentMessageBuffer: "",
    pendingFlush: [],
    mainsCtx: {
      workspaceId: "workspace-1",
      rootPath,
      runId: "run-1",
    },
    fileChangeBuffers: new Map(),
    fileChangeItems: new Map(),
    commandOutputBuffers: new Map(),
    emittedImagePaths: new Set(),
    emittedDocPaths: new Set(),
    runStartedAt: Date.now(),
    planBuffers: new Map(),
    subAgents: new Map(),
  };
}

function createHarness(state = createRunState()) {
  const runs = new Map([["run-1", state]]);
  const onReviewCompleted = vi.fn();
  const onParentThreadStarted = vi.fn();
  const mapper = createCodexEventMapper({
    getRunState: (runId) => runs.get(runId),
    onReviewCompleted,
    onParentThreadStarted,
    defaultModel: "gpt-fixture-codex",
  });
  return {
    mapper,
    onParentThreadStarted,
    onReviewCompleted,
    state,
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("Codex event mapper", () => {
  it("owns parent thread registration and agent-message buffering", () => {
    const state = createRunState();
    state.threadId = null;
    const { mapper, onParentThreadStarted } =
      createHarness(state);

    mapper.mapNotification(
      "thread/started",
      {
        thread: {
          id: "thread-new",
          agentNickname: null,
          agentRole: null,
        },
      },
      "run-1",
    );
    const streaming = mapper.mapNotification(
      "item/agentMessage/delta",
      {
        threadId: "thread-new",
        itemId: "message-1",
        delta: "Hello",
      },
      "run-1",
    );
    const completed = mapper.mapNotification(
      "item/completed",
      {
        threadId: "thread-new",
        item: {
          id: "message-1",
          type: "agentMessage",
        },
      },
      "run-1",
    );

    expect(state.threadId).toBe("thread-new");
    expect(onParentThreadStarted).toHaveBeenCalledWith(
      "run-1",
      "thread-new",
    );
    expect(streaming).toContainEqual(
      expect.objectContaining({
        type: "artifact",
        content: "Hello",
        ephemeral: true,
        streamId: "codex-msg-run-1-message-1",
      }),
    );
    expect(completed).toContainEqual(
      expect.objectContaining({
        type: "artifact",
        kind: "report",
        content: "Hello",
        metadata: {
          source: "agent_message",
          itemId: "message-1",
        },
      }),
    );
    expect(state.agentMessageBuffer).toBe("");
  });

  it("deduplicates live usage snapshots for the same turn", () => {
    const { mapper } = createHarness();

    const first = mapper.mapNotification(
      "thread/tokenUsage/updated",
      {
        threadId: "thread-parent",
        turnId: "turn-1",
        tokenUsage: {
          last: {
            totalTokens: 10,
            inputTokens: 8,
            outputTokens: 2,
          },
          modelContextWindow: 100,
        },
      },
      "run-1",
      "gpt-fixture-codex",
    );
    const second = mapper.mapNotification(
      "thread/tokenUsage/updated",
      {
        threadId: "thread-parent",
        turnId: "turn-1",
        tokenUsage: {
          last: {
            totalTokens: 15,
            inputTokens: 12,
            outputTokens: 3,
          },
          modelContextWindow: 100,
        },
      },
      "run-1",
      "gpt-fixture-codex",
    );

    expect(first).toContainEqual(
      expect.objectContaining({
        type: "context_usage",
        totalTokens: 10,
        maxTokens: 100,
        percentage: 10,
      }),
    );
    expect(second).toContainEqual(
      expect.objectContaining({
        type: "context_usage",
        totalTokens: 15,
        percentage: 15,
      }),
    );
    expect(mapper.flushUsage("run-1")).toMatchObject({
      inputTokens: 12,
      outputTokens: 3,
      numTurns: 1,
      model: "gpt-fixture-codex",
    });
    expect(mapper.flushUsage("run-1")).toBeUndefined();
  });

  it("filters sub-thread items into one heartbeat event", () => {
    const state = createRunState();
    state.subAgents.set("thread-child", {
      threadId: "thread-child",
      nickname: "Scout",
      role: "researcher",
    });
    const { mapper } = createHarness(state);

    const events = mapper.mapNotification(
      "item/completed",
      {
        threadId: "thread-child",
        item: {
          id: "child-command",
          type: "commandExecution",
          command: "npm test",
          status: "completed",
        },
      },
      "run-1",
    );

    expect(events).toEqual([
      expect.objectContaining({
        type: "artifact",
        content: "Subagent Scout (researcher) working…",
        ephemeral: true,
        streamId:
          "codex-cmd-subagent-run-1-thread-child",
      }),
    ]);
  });

  it("projects command items into stable logical tool rows", () => {
    const { mapper } = createHarness();
    const started = mapper.mapThreadItem(
      {
        id: "command-1",
        type: "commandExecution",
        command: "rg 'needle' src",
        status: "inProgress",
      },
      "item/started",
      100,
      "run-1",
    );

    expect(started).toEqual([
      expect.objectContaining({
        type: "tool_call",
        toolName: "Grep",
        input: { pattern: "needle", path: "src" },
        metadata: expect.objectContaining({
          phase: "start",
          toolCallId: "command-1",
        }),
      }),
    ]);

    mapper.mapThreadItem(
      {
        id: "command-1",
        type: "commandExecution",
        command: "rg 'needle' src",
        aggregatedOutput: "src/example.ts:needle",
        status: "inProgress",
      },
      "item/updated",
      110,
      "run-1",
    );
    const completed = mapper.mapThreadItem(
      {
        id: "command-1",
        type: "commandExecution",
        command: "rg 'needle' src",
        exitCode: 0,
        status: "completed",
      },
      "item/completed",
      120,
      "run-1",
    );

    const toolComplete = completed.find(
      (event) =>
        event.type === "tool_call" &&
        event.metadata?.phase === "complete",
    );
    expect(toolComplete).toMatchObject({
      type: "tool_call",
      toolName: "Grep",
      input: { pattern: "needle", path: "src" },
    });
    expect(
      JSON.parse(
        (toolComplete as Extract<
          WorkRunEvent,
          { type: "tool_call" }
        >).output as string,
      ),
    ).toEqual({
      content: "src/example.ts:needle",
      numLines: 1,
    });
  });

  it("turns a completed streamed plan into one pending Plan tool call", () => {
    const state = createRunState();
    state.planBuffers.set("plan-1", "1. Inspect\n2. Change");
    const { mapper } = createHarness(state);

    const events = mapper.mapThreadItem(
      { id: "plan-1", type: "plan", text: "stale" },
      "item/completed",
      200,
      "run-1",
    );

    expect(state.planBuffers.has("plan-1")).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({
        type: "artifact",
        content: "",
        streamId: "codex-plan-run-1-plan-1",
      }),
      expect.objectContaining({
        type: "tool_call",
        toolName: "Plan",
        input: { plan: "1. Inspect\n2. Change" },
        metadata: expect.objectContaining({ phase: "start" }),
      }),
      expect.objectContaining({
        type: "tool_call",
        toolName: "Plan",
        output: { planStatus: "pending" },
        metadata: expect.objectContaining({ phase: "complete" }),
      }),
    ]);
  });

  it("keeps review persistence outside the projection implementation", () => {
    const { mapper, onReviewCompleted } = createHarness();

    const events = mapper.mapThreadItem(
      {
        id: "review-1",
        type: "exitedReviewMode",
        review: "Review complete.",
      },
      "item/completed",
      300,
      "run-1",
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "artifact",
        kind: "report",
        content: "Review complete.",
      }),
    );
    expect(onReviewCompleted).toHaveBeenCalledWith(
      "run-1",
      "review-1",
      "Review complete.",
    );
  });

  it("discovers newly-created workspace documents once", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "mains-codex-events-"),
    );
    tempDirs.push(tempDir);
    const documentPath = path.join(tempDir, "report.docx");
    fs.writeFileSync(documentPath, "fixture");
    const { mapper } = createHarness(createRunState(tempDir));
    const item = {
      id: "command-doc",
      type: "unknownFixtureItem",
      output: `Created ${documentPath}`,
    };

    const first = mapper.mapThreadItem(
      item,
      "item/completed",
      400,
      "run-1",
    );
    const second = mapper.mapThreadItem(
      item,
      "item/completed",
      500,
      "run-1",
    );

    expect(first).toContainEqual(
      expect.objectContaining({
        type: "artifact",
        kind: "document",
        metadata: expect.objectContaining({
          path: documentPath,
          docType: "docx",
        }),
      }),
    );
    expect(
      second.filter(
        (event) =>
          event.type === "artifact" &&
          event.kind === "document",
      ),
    ).toHaveLength(0);
  });
});
