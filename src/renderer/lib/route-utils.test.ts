import { describe, it, expect } from "vitest";
import { getRouteType, getBaseRoutePath } from "./route-utils";

describe("getRouteType", () => {
  it('returns "home" for /', () => {
    expect(getRouteType("/")).toBe("home");
  });

  it('returns "settings" for /settings', () => {
    expect(getRouteType("/settings")).toBe("settings");
  });

  it('returns "settings" for /settings/subroute', () => {
    expect(getRouteType("/settings/account")).toBe("settings");
  });

  it('returns "claude" for /claude', () => {
    expect(getRouteType("/claude")).toBe("claude");
  });

  it('returns "claude" for /claude/:id', () => {
    expect(getRouteType("/claude/workspace-123")).toBe("claude");
  });

  it('returns "copilot" for /copilot', () => {
    expect(getRouteType("/copilot")).toBe("copilot");
  });

  it('returns "copilot" for /copilot/:id', () => {
    expect(getRouteType("/copilot/workspace-456")).toBe("copilot");
  });

  it('returns "unknown" for unmatched path', () => {
    expect(getRouteType("/random/path")).toBe("unknown");
  });
});

describe("getBaseRoutePath", () => {
  it('returns /claude for "claude"', () => {
    expect(getBaseRoutePath("claude")).toBe("/claude");
  });

  it('returns /copilot for "copilot"', () => {
    expect(getBaseRoutePath("copilot")).toBe("/copilot");
  });

  it('returns /settings for "settings"', () => {
    expect(getBaseRoutePath("settings")).toBe("/settings");
  });

  it('returns / for "home"', () => {
    expect(getBaseRoutePath("home")).toBe("/");
  });

  it('returns / for "unknown"', () => {
    expect(getBaseRoutePath("unknown")).toBe("/");
  });
});
