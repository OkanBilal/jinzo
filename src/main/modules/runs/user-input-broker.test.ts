import { afterEach, describe, expect, it, vi } from "vitest";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import {
  clearEventSinks,
  registerEventSink,
  type EventSink,
} from "../../ipc-kit";
import {
  cancelPendingRequest,
  clearAllPendingRequests,
  requestToolApproval,
} from "./user-input-broker";

afterEach(() => {
  clearAllPendingRequests();
  clearEventSinks();
});

describe("user-input-broker", () => {
  it("resolves and dismisses one provider-owned approval request", async () => {
    const send = vi.fn();
    const sink: EventSink = { kind: "test", send };
    registerEventSink(sink);

    const responsePromise = requestToolApproval({
      requestId: "request-1",
      runId: "run-1",
      toolName: "Bash",
      kind: "tool_approval",
      timestamp: Date.now(),
    });

    cancelPendingRequest("request-1");

    await expect(responsePromise).resolves.toEqual({
      requestId: "request-1",
      approved: false,
    });
    expect(send).toHaveBeenCalledWith(
      CHANNELS.runs.toolApprovalResolved,
      { requestId: "request-1" },
      { runId: "run-1" },
    );
  });
});
