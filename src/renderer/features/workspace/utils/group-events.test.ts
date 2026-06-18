import { describe, it, expect } from "vitest";
import { groupEvents, reconcileEventGroups } from "./group-events";
import type { RunEvent } from "../types";

function ev(partial: Partial<RunEvent> & { id: string }): RunEvent {
  return {
    type: "artifact",
    content: "",
    timestamp: new Date(partial.id.length * 1000),
    ...partial,
  };
}

/** A user prompt + an agent response + a streamed tail tool call. */
function baseEvents(): RunEvent[] {
  return [
    ev({ id: "u1", type: "artifact", content: "hello", metadata: { kind: "user-prompt" } }),
    ev({ id: "r1", type: "artifact", content: "hi there", metadata: { kind: "report" } }),
    ev({ id: "t1", type: "tool_call", content: "Read: a.ts", metadata: { status: "done" } }),
  ];
}

describe("reconcileEventGroups", () => {
  it("returns the same array reference when nothing changed", () => {
    const prev = groupEvents(baseEvents());
    // Re-group an identical event list (fresh objects, same content).
    const next = groupEvents(baseEvents());
    const result = reconcileEventGroups(prev, next);
    expect(result).toBe(prev);
  });

  it("preserves group identity for unchanged groups when one group changes", () => {
    const prev = groupEvents(baseEvents());

    // Append a new tool call (a streamed token arriving) — only the trailing
    // content changes; the user prompt + response groups are untouched.
    const grown = baseEvents();
    grown.push(ev({ id: "t2", type: "tool_call", content: "Edit: a.ts", metadata: { status: "running" } }));
    const next = groupEvents(grown);

    const result = reconcileEventGroups(prev, next);

    expect(result).not.toBe(prev); // array changed (a group was added)
    // user prompt group + response group reused by reference...
    expect(result[0]).toBe(prev[0]);
    expect(result[1]).toBe(prev[1]);
    // ...but the tool group (now holding t1 + t2) is a fresh object.
    expect(result[2]).not.toBe(prev[2]);
  });

  it("does NOT reuse a group whose event content changed (no stale UI)", () => {
    const prev = groupEvents(baseEvents());

    // Same group ids, but the response text grew (streaming into r1).
    const edited = baseEvents();
    edited[1] = ev({ id: "r1", type: "artifact", content: "hi there, more text", metadata: { kind: "report" } });
    const next = groupEvents(edited);

    const result = reconcileEventGroups(prev, next);

    expect(result[0]).toBe(prev[0]); // user prompt unchanged → reused
    expect(result[1]).not.toBe(prev[1]); // response changed → fresh reference
    expect(result[1].events[0].content).toBe("hi there, more text");
  });

  it("does NOT reuse a tool group whose status flipped running → done", () => {
    const running = baseEvents();
    running[2] = ev({ id: "t1", type: "tool_call", content: "Read: a.ts", metadata: { status: "running" } });
    const prev = groupEvents(running);

    const done = baseEvents(); // t1 is "done"
    const next = groupEvents(done);

    const result = reconcileEventGroups(prev, next);
    expect(result[2]).not.toBe(prev[2]);
    expect(result[2].events[0].metadata?.status).toBe("done");
  });

  it("returns next unchanged when there is no previous result", () => {
    const next = groupEvents(baseEvents());
    expect(reconcileEventGroups(null, next)).toBe(next);
    expect(reconcileEventGroups([], next)).toBe(next);
  });
});
