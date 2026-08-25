import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  isLoopbackHost,
  tokensMatch,
} from "./ws-auth";

describe("tokensMatch", () => {
  it("accepts an exact match", () => {
    expect(tokensMatch("s3cret-token", "s3cret-token")).toBe(true);
  });

  it("rejects a mismatch, null, empty, and length differences", () => {
    expect(tokensMatch("s3cret", "wrong")).toBe(false);
    expect(tokensMatch("s3cret", null)).toBe(false);
    expect(tokensMatch("s3cret", "")).toBe(false);
    expect(tokensMatch("s3cret", "s3cret-longer")).toBe(false);
  });
});

describe("isLoopbackHost", () => {
  it("treats loopback / unset hosts as loopback", () => {
    for (const host of [undefined, null, "127.0.0.1", "::1", "localhost"]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
  });

  it("treats routable hosts as non-loopback", () => {
    for (const host of ["0.0.0.0", "192.168.1.5", "example.com"]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });
});

describe("generateToken", () => {
  it("produces unique URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });
});

describe("hashToken", () => {
  it("is deterministic, hex, and does not echo the token", () => {
    const token = generateToken();
    const hash = hashToken(token);
    expect(hash).toBe(hashToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashToken(generateToken())).not.toBe(hash);
  });
});
