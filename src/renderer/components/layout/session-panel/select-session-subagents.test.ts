import { describe, it, expect } from "vitest";
import type { ToolCall } from "@/lib/redux/api";
import { selectSessionSubagents } from "./select-session-subagents";

function call(partial: Partial<ToolCall> & { id: number }): ToolCall {
  return {
    accountId: "acc",
    runId: "run-1",
    providerId: "claude_code",
    toolName: "Agent",
    status: "running",
    input: null,
    output: null,
    error: null,
    startedAt: null,
    endedAt: null,
    latencyMs: null,
    costMicros: null,
    metadata: null,
    createdAt: 0,
    ...partial,
  } as ToolCall;
}

describe("selectSessionSubagents", () => {
  it("reads the agent type and description off subagent + task metadata", () => {
    const [agent] = selectSessionSubagents([
      call({
        id: 1,
        metadata: {
          subagent: { phase: "running", agentType: "Explore" },
          task: { phase: "started", status: "running", description: "Find the API" },
        },
      }),
    ]);

    expect(agent).toEqual({
      id: 1,
      agentType: "Explore",
      description: "Find the API",
      state: "running",
    });
  });

  it("falls back to the tool input when no lifecycle metadata landed", () => {
    const [agent] = selectSessionSubagents([
      call({
        id: 1,
        status: "done",
        input: { subagent_type: "general-purpose", description: "Audit deps" },
      }),
    ]);

    expect(agent).toMatchObject({
      agentType: "general-purpose",
      description: "Audit deps",
      state: "done",
    });
  });

  it("excludes backgrounded shell commands, which are tasks but not subagents", () => {
    const agents = selectSessionSubagents([
      call({
        id: 1,
        toolName: "Bash",
        metadata: { task: { phase: "started", taskType: "local_bash" } },
      }),
    ]);

    expect(agents).toEqual([]);
  });

  it("excludes ordinary tool calls", () => {
    expect(selectSessionSubagents([call({ id: 1, toolName: "Read" })])).toEqual([]);
  });

  // A failed task and a canceled tool call are distinct outcomes; both have to
  // beat the `done` status the tool call itself settles on.
  it.each([
    ["task error", { task: { error: "boom" } }, "failed"],
    ["task stopped", { task: { status: "stopped" } }, "stopped"],
    ["subagent failure", { subagent: { phase: "failed" } }, "failed"],
    ["completion", { task: { phase: "completed", status: "completed" } }, "done"],
  ])("maps %s to %s", (_label, metadata, expected) => {
    const [agent] = selectSessionSubagents([
      call({ id: 1, status: "done", metadata: metadata as Record<string, unknown> }),
    ]);
    expect(agent.state).toBe(expected);
  });

  it("returns subagents newest-first regardless of row order", () => {
    const agents = selectSessionSubagents([
      call({ id: 2, input: { subagent_type: "b" } }),
      call({ id: 7, input: { subagent_type: "c" } }),
      call({ id: 1, input: { subagent_type: "a" } }),
    ]);

    expect(agents.map((a) => a.agentType)).toEqual(["c", "b", "a"]);
  });
});
