import { describe, it, expect } from "vitest";
import reducer, {
  setActiveTab,
  setActiveWorkspaceId,
  setActiveWorkspaceForProvider,
} from "./workspaceSlice";

// `activeTab` is one global field, but a run tab belongs to exactly one
// workspace. Carrying it across a switch pointed every tab-derived reader — the
// transcript's auto-select, the session panel's run — at a run the new
// workspace doesn't have.
describe("workspaceSlice — the active tab across a workspace switch", () => {
  const onRunTab = (workspaceId: string | null) => {
    let state = reducer(undefined, setActiveWorkspaceId(workspaceId));
    state = reducer(state, setActiveTab("run-from-ws-a"));
    return state;
  };

  it("drops the previous workspace's run tab", () => {
    const state = reducer(onRunTab("ws-a"), setActiveWorkspaceId("ws-b"));
    expect(state.activeTab).toBe("editor");
  });

  it("drops it on the per-provider switch too", () => {
    let state = onRunTab("ws-a");
    state = reducer(
      state,
      setActiveWorkspaceForProvider({ providerId: "claude_code", workspaceId: "ws-b" }),
    );
    expect(state.activeTab).toBe("editor");
  });

  it("keeps the tab when the same workspace is set again", () => {
    const state = reducer(onRunTab("ws-a"), setActiveWorkspaceId("ws-a"));
    expect(state.activeTab).toBe("run-from-ws-a");
  });

  it("keeps the tab when the same workspace is set again per provider", () => {
    let state = reducer(
      undefined,
      setActiveWorkspaceForProvider({ providerId: "claude_code", workspaceId: "ws-a" }),
    );
    state = reducer(state, setActiveTab("run-1"));
    state = reducer(
      state,
      setActiveWorkspaceForProvider({ providerId: "claude_code", workspaceId: "ws-a" }),
    );
    expect(state.activeTab).toBe("run-1");
  });
});
