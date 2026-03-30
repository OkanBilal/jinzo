import { describe, it, expect } from "vitest";
import { validateConnectionId, validateUpdatePayload } from "./connectionStates.validation";

describe("validateConnectionId", () => {
  it("returns null for a valid string", () => {
    expect(validateConnectionId("github")).toBeNull();
  });

  it("returns error for empty string", () => {
    expect(validateConnectionId("")).toBe("Invalid connection ID");
  });

  it("returns error for null", () => {
    expect(validateConnectionId(null)).toBe("Invalid connection ID");
  });

  it("returns error for undefined", () => {
    expect(validateConnectionId(undefined)).toBe("Invalid connection ID");
  });

  it("returns error for number", () => {
    expect(validateConnectionId(42)).toBe("Invalid connection ID");
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
