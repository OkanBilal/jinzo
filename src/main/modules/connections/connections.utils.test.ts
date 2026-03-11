import { describe, it, expect } from "vitest";
import {
  formatSourceName,
  parseConnectionMetadata,
  parseResourceMetadata,
} from "./connections.utils";

describe("formatSourceName", () => {
  it("maps known source names", () => {
    expect(formatSourceName("playlists")).toBe("Library Playlists");
    expect(formatSourceName("recently-played")).toBe("Recently Played");
    expect(formatSourceName("heavy-rotation")).toBe("Heavy Rotation");
    expect(formatSourceName("top-tracks")).toBe("Top Tracks");
    expect(formatSourceName("top-artists")).toBe("Top Artists");
    expect(formatSourceName("saved-albums")).toBe("Saved Albums");
  });

  it("returns the original string for unknown names", () => {
    expect(formatSourceName("custom-source")).toBe("custom-source");
  });
});

describe("parseConnectionMetadata", () => {
  it("returns empty object for null", () => {
    expect(parseConnectionMetadata(null)).toEqual({});
  });

  it("parses valid JSON string", () => {
    expect(parseConnectionMetadata('{"key":"value"}')).toEqual({ key: "value" });
  });

  it("returns empty object for invalid JSON string", () => {
    expect(parseConnectionMetadata("not json")).toEqual({});
  });

  it("returns empty object for non-object JSON", () => {
    expect(parseConnectionMetadata('"just a string"')).toEqual({});
  });

  it("passes through object directly", () => {
    const obj = { domain: "github.com" };
    expect(parseConnectionMetadata(obj)).toBe(obj);
  });
});

describe("parseResourceMetadata", () => {
  it("returns empty object for null", () => {
    expect(parseResourceMetadata(null)).toEqual({});
  });

  it("parses valid JSON string", () => {
    expect(parseResourceMetadata('{"repo":"test"}')).toEqual({ repo: "test" });
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseResourceMetadata("bad json")).toEqual({});
  });
});
