import { describe, it, expect } from "vitest";
import type { EventGroup } from "../utils/group-events";
import type { RunEvent } from "../types";
import type { RunTurn } from "@/lib/redux/api";
import {
  buildTurnRenderRows,
  matchTurnsToGroups,
  isUserPromptGroup,
  type TurnRenderRow,
} from "./transcript-rows";

let seq = 0;
function ev(partial: Partial<RunEvent>): RunEvent {
  return { id: `e${seq++}`, type: "log", content: "", timestamp: new Date(0), ...partial };
}
function grp(
  type: EventGroup["type"],
  events: RunEvent[],
  startMs = 0,
  endMs = 0,
): EventGroup {
  return { id: `g${seq++}`, type, events, startTime: new Date(startMs), endTime: new Date(endMs) };
}
const userPrompt = (startMs = 0, endMs = 0) =>
  grp("info", [ev({ type: "log", metadata: { kind: "user-prompt" } })], startMs, endMs);
const response = (content = "hi", startMs = 0, endMs = 0) =>
  grp("response", [ev({ type: "log", content })], startMs, endMs);
const toolCalls = (n = 1) =>
  grp(
    "tool_calls",
    Array.from({ length: n }, () => ev({ type: "tool_call", content: "Bash: ls" })),
  );

function accordion(row: TurnRenderRow) {
  if (row.kind !== "accordion") throw new Error("expected accordion row");
  return row;
}

describe("isUserPromptGroup", () => {
  it("matches an info group whose first event is a user prompt", () => {
    expect(isUserPromptGroup(userPrompt())).toBe(true);
    expect(isUserPromptGroup(response())).toBe(false);
    expect(isUserPromptGroup(toolCalls())).toBe(false);
  });
});

describe("buildTurnRenderRows", () => {
  it("renders a prompt and a single reply as two flat rows", () => {
    const rows = buildTurnRenderRows([userPrompt(), response()]);
    expect(rows).toEqual([
      { kind: "flat", indices: [0] },
      { kind: "flat", indices: [1] },
    ]);
  });

  it("collapses earlier replies into an accordion when a turn has multiple replies", () => {
    // prompt(0) reply(1) tools(2) reply(3) — two reply segments → accordion
    const rows = buildTurnRenderRows([userPrompt(), response(), toolCalls(1), response()]);
    expect(rows[0]).toEqual({ kind: "flat", indices: [0] });
    const acc = accordion(rows[1]);
    expect(acc.previousSegments).toEqual([[1, 2]]);
    expect(acc.lastSegment).toEqual([3]);
    expect(acc.previousMessageCount).toBe(1);
    expect(acc.previousToolSummary).toBe("1 tool call");
  });

  it("counts every tool call across collapsed segments (plural summary)", () => {
    // prompt reply tools(2) reply tools(1) reply → 3 collapsed tool calls, 2 prior replies
    const rows = buildTurnRenderRows([
      userPrompt(),
      response(),
      toolCalls(2),
      response(),
      toolCalls(1),
      response(),
    ]);
    const acc = accordion(rows[1]);
    expect(acc.lastSegment).toEqual([5]);
    expect(acc.previousMessageCount).toBe(2);
    expect(acc.previousToolSummary).toBe("3 tool calls");
  });
});

describe("matchTurnsToGroups", () => {
  it("attaches a completed turn's elapsed time to its last group", () => {
    const groups = [response("a", 0, 1000), response("b", 1000, 2000)];
    const turns = [
      { status: "completed", elapsedMs: 1500, endedAt: new Date(9_999_999_999_999) },
    ] as unknown as RunTurn[];
    const map = matchTurnsToGroups(groups, turns);
    expect(map.get(1)?.elapsed).toBe(1500);
  });

  it("ignores turns that are not completed or have no elapsed time", () => {
    const groups = [response("a", 0, 1000)];
    const turns = [
      { status: "running", elapsedMs: 0, endedAt: null },
    ] as unknown as RunTurn[];
    expect(matchTurnsToGroups(groups, turns).size).toBe(0);
  });

  it("falls back to event timings when there are no backend turns", () => {
    // prompt(0) reply(ends 1000) prompt(starts 1500) → one session bar at the reply
    const groups = [userPrompt(0, 0), response("a", 0, 1000), userPrompt(1500, 1500)];
    const map = matchTurnsToGroups(groups, []);
    expect(map.get(1)?.elapsed).toBe(1000);
  });
});
