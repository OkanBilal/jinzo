import { describe, expect, it } from "vitest";
import type { RunEvent } from "../types";
import {
  parseStructuralPlanSnapshot,
  selectTodoSnapshot,
} from "./todo-summary-bar";

describe("TodoSummaryBar structural plans", () => {
  it("prefers the persisted structural plan over legacy tool snapshots", () => {
    const events: RunEvent[] = [{
      id: "event-1",
      type: "tool_call",
      content: "UpdateTodos",
      timestamp: new Date(1),
      metadata: {
        input: {
          todos: [{
            content: "Stale tool task",
            status: "in_progress",
          }],
        },
      },
    }];
    const structuralPlan = parseStructuralPlanSnapshot({
      providerTurnId: "turn-1",
      explanation: "Executing",
      steps: [
        { step: "Inspect", status: "completed" },
        { step: "Implement", status: "in_progress" },
        { step: "Verify", status: "pending" },
      ],
      updatedAt: 123,
    });

    expect(structuralPlan).not.toBeNull();
    expect(selectTodoSnapshot(events, structuralPlan)).toEqual([
      { content: "Inspect", status: "completed" },
      { content: "Implement", status: "in_progress" },
      { content: "Verify", status: "pending" },
    ]);
  });
});
