import { describe, it, expect } from "vitest";
import { resolveTool } from "./resolve-tool";

// Connected codex apps (Gmail, Linear, Google Calendar, …) are bridged through
// the `codex_apps` MCP server. The app slug `resolveTool` extracts is what the
// plugin-logo lookup keys on, so mis-parsing it swaps the app's real logo for
// the generic MCP glyph. Newer codex builds switched the app/verb delimiter
// from `_` to `.`, which the first-underscore heuristic mis-split
// (`gmail.get_profile` → `gmail.get`) — this guards both delimiters.
describe("resolveTool — codex_apps bridge sub-provider slug", () => {
  it("parses dot-delimited app names (current codex format)", () => {
    expect(resolveTool("mcp__codex_apps__gmail.get_profile").vendorId).toBe(
      "gmail",
    );
    expect(resolveTool("mcp__codex_apps__linear.list_teams").vendorId).toBe(
      "linear",
    );
    // App slug may itself contain underscores — the dot is the real boundary.
    expect(
      resolveTool("mcp__codex_apps__google_calendar.get_profile").vendorId,
    ).toBe("google_calendar");
  });

  it("still parses legacy underscore-delimited app names", () => {
    expect(resolveTool("mcp__codex_apps__gmail_get_profile").vendorId).toBe(
      "gmail",
    );
    expect(resolveTool("mcp__codex_apps__linear_list_issues").vendorId).toBe(
      "linear",
    );
  });
});
