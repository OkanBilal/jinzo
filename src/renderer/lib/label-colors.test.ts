import { describe, it, expect } from "vitest";
import { getLabelColor, parseLabels } from "./label-colors";

describe("getLabelColor", () => {
  it("returns color for known label (case-insensitive)", () => {
    const result = getLabelColor("Bug");
    expect(result).toContain("bg-red");
  });

  it("returns color for 'feature'", () => {
    const result = getLabelColor("feature");
    expect(result).toContain("bg-purple");
  });

  it("matches partial label (e.g. 'security audit' contains 'security')", () => {
    const result = getLabelColor("security audit");
    expect(result).toContain("bg-red");
  });

  it("returns default color for unknown label", () => {
    const result = getLabelColor("completely-unknown-xyz");
    expect(result).toContain("bg-primary");
  });

  it("matches 'in progress' with space", () => {
    const result = getLabelColor("in progress");
    expect(result).toContain("bg-blue");
  });

  it("matches 'in-progress' with hyphen", () => {
    const result = getLabelColor("in-progress");
    expect(result).toContain("bg-blue");
  });
});

describe("parseLabels", () => {
  it("returns empty array for null", () => {
    expect(parseLabels(null)).toEqual([]);
  });

  it("parses valid JSON array", () => {
    expect(parseLabels('["bug","feature"]')).toEqual(["bug", "feature"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseLabels("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseLabels('"just a string"')).toEqual([]);
  });

  it("returns empty array for JSON object", () => {
    expect(parseLabels('{"key":"value"}')).toEqual([]);
  });
});
