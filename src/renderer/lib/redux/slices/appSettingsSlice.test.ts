import { describe, it, expect } from "vitest";
import reducer, { setSessionPanelOpen } from "./appSettingsSlice";
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
