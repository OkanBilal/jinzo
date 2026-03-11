import { describe, it, expect } from "vitest";
import { validateSpaceId } from "./appSettings.validation";

describe("validateSpaceId", () => {
  it("accepts null", () => {
    const result = validateSpaceId(null);
    expect(result).toEqual({ value: null, error: null });
  });

  it("accepts undefined", () => {
    const result = validateSpaceId(undefined);
    expect(result).toEqual({ value: null, error: null });
  });

  it("accepts a valid string", () => {
    const result = validateSpaceId("space-123");
    expect(result).toEqual({ value: "space-123", error: null });
  });

  it("rejects a number", () => {
    const result = validateSpaceId(42);
    expect(result.error).toBe("spaceId must be a string or null");
  });

  it("rejects a boolean", () => {
    const result = validateSpaceId(true);
    expect(result.error).toBe("spaceId must be a string or null");
  });

  it("rejects an object", () => {
    const result = validateSpaceId({ id: "space" });
    expect(result.error).toBe("spaceId must be a string or null");
  });
});
