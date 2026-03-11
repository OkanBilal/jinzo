import { describe, it, expect } from "vitest";
import { validateAppId, validateUpdatePayload } from "./apps.validation";

describe("validateAppId", () => {
  it("returns null for a valid string", () => {
    expect(validateAppId("github")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validateAppId("")).toBe("Invalid app ID");
  });

  it("returns error for null", () => {
    expect(validateAppId(null)).toBe("Invalid app ID");
  });

  it("returns error for undefined", () => {
    expect(validateAppId(undefined)).toBe("Invalid app ID");
  });

  it("returns error for number", () => {
    expect(validateAppId(42)).toBe("Invalid app ID");
  });
});

describe("validateUpdatePayload", () => {
  it("accepts valid payload with isConnected true", () => {
    const result = validateUpdatePayload({ isConnected: true });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ isConnected: true, connectionId: null });
  });

  it("accepts payload with connectionId", () => {
    const result = validateUpdatePayload({
      isConnected: true,
      connectionId: "conn-1",
    });
    expect(result.data).toEqual({ isConnected: true, connectionId: "conn-1" });
  });

  it("sets connectionId to null when non-string", () => {
    const result = validateUpdatePayload({
      isConnected: false,
      connectionId: 42,
    });
    expect(result.data!.connectionId).toBeNull();
  });

  it("rejects null payload", () => {
    const result = validateUpdatePayload(null);
    expect(result.error).toBe("Invalid payload");
  });

  it("rejects non-object payload", () => {
    const result = validateUpdatePayload("string");
    expect(result.error).toBe("Invalid payload");
  });

  it("rejects missing isConnected", () => {
    const result = validateUpdatePayload({});
    expect(result.error).toBe("isConnected must be a boolean");
  });

  it("rejects non-boolean isConnected", () => {
    const result = validateUpdatePayload({ isConnected: "yes" });
    expect(result.error).toBe("isConnected must be a boolean");
  });
});
