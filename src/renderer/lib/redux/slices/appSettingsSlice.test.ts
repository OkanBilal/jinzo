import { describe, it, expect } from "vitest";
import reducer, {
  setSessionPanelOpen,
  setWorkspaceGroupExpanded,
  setTrackerSectionState,
} from "./appSettingsSlice";
import { openNewRunTab, setActiveTab } from "./workspaceSlice";

const open = () => reducer(undefined, setSessionPanelOpen(true));

// The session panel reads the run in the active tab. A new-run tab has no run,
// so switching to one has to dismiss the panel rather than leave the previous
// tab's state on screen. The rule lives in the slice so every route into that
// tab is covered by one place.
describe("appSettingsSlice — session panel vs the new-run tab", () => {
  it("closes on the new-run tab being opened", () => {
    expect(reducer(open(), openNewRunTab()).sessionPanelOpen).toBe(false);
  });

  it("closes when the new-run tab is selected directly", () => {
    expect(reducer(open(), setActiveTab("new-run")).sessionPanelOpen).toBe(false);
  });

  it("leaves it open when switching between run tabs", () => {
    expect(reducer(open(), setActiveTab("run-123")).sessionPanelOpen).toBe(true);
    expect(reducer(open(), setActiveTab("editor")).sessionPanelOpen).toBe(true);
  });

  // Reacting to the switch, not to the tab: reopening it by hand while sitting
  // on a new-run tab has to stick.
  it("can be reopened while the new-run tab is active", () => {
    const closed = reducer(open(), openNewRunTab());
    expect(reducer(closed, setSessionPanelOpen(true)).sessionPanelOpen).toBe(true);
  });
});

// These two used to be one localStorage key per group / per project. As slice
// records their defaults are no longer "whatever the key parsed to", so the
// absent case is what needs pinning down.
describe("appSettingsSlice — per-entity UI records", () => {
  it("defaults a group to expanded and only stores the ones touched", () => {
    const state = reducer(
      undefined,
      setWorkspaceGroupExpanded({ groupKey: "in_progress", expanded: false }),
    );

    expect(state.workspaceGroupExpanded).toEqual({ in_progress: false });
    // Untouched groups hold no entry — the reader's `?? true` is the default.
    expect(state.workspaceGroupExpanded["done"]).toBeUndefined();
  });

  it("keeps groups independent", () => {
    let state = reducer(
      undefined,
      setWorkspaceGroupExpanded({ groupKey: "todo", expanded: false }),
    );
    state = reducer(
      state,
      setWorkspaceGroupExpanded({ groupKey: "done", expanded: true }),
    );

    expect(state.workspaceGroupExpanded).toEqual({ todo: false, done: true });
  });

  // The tracker writes expanded and filter from separate handlers, so a partial
  // update must not reset the other field to its default.
  it("merges a partial tracker update onto the existing project state", () => {
    let state = reducer(
      undefined,
      setTrackerSectionState({ projectId: "p1", changes: { expanded: true } }),
    );
    state = reducer(
      state,
      setTrackerSectionState({ projectId: "p1", changes: { filter: "issues" } }),
    );

    expect(state.trackerByProject["p1"]).toEqual({
      expanded: true,
      filter: "issues",
    });
  });

  it("seeds an untouched project from the defaults before merging", () => {
    const state = reducer(
      undefined,
      setTrackerSectionState({ projectId: "p2", changes: { filter: "signals" } }),
    );

    expect(state.trackerByProject["p2"]).toEqual({
      expanded: false,
      filter: "signals",
    });
  });

  it("keeps projects independent", () => {
    let state = reducer(
      undefined,
      setTrackerSectionState({ projectId: "p1", changes: { expanded: true } }),
    );
    state = reducer(
      state,
      setTrackerSectionState({ projectId: "p2", changes: { expanded: false } }),
    );

    expect(state.trackerByProject["p1"].expanded).toBe(true);
    expect(state.trackerByProject["p2"].expanded).toBe(false);
  });
});
