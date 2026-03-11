import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/client", () => ({
  getDb: vi.fn(),
}));

vi.mock("../connectionCredentials/connectionCredentials.utils", () => ({
  decryptSecrets: vi.fn(),
}));

import {
  getConnectionByProvider,
  getConnectionSecrets,
  getSelectedResources,
  getConnectionWithSecrets,
  normalizeLimit,
  normalizeDateToIso,
  safeJsonParse,
} from "./sync.connection-utils";
import { getDb } from "../../db/client";
import { decryptSecrets } from "../connectionCredentials/connectionCredentials.utils";

// Helper to build a chainable Drizzle query mock
function mockQuery(result: any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.get = vi.fn().mockReturnValue(result);
  chain.all = vi.fn().mockReturnValue(Array.isArray(result) ? result : []);
  return chain;
}

describe("sync.connection-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────
  // getConnectionByProvider
  // ───────────────────────────────────────────────
  describe("getConnectionByProvider", () => {
    it("returns connection id and parsed metadata", async () => {
      const db = mockQuery({ id: "conn-1", metadata: '{"domain":"example.com"}' });
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionByProvider("jira");
      expect(result).toEqual({ id: "conn-1", metadata: { domain: "example.com" } });
    });

    it("returns empty metadata when connection has no metadata", async () => {
      const db = mockQuery({ id: "conn-2", metadata: null });
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionByProvider("github");
      expect(result).toEqual({ id: "conn-2", metadata: {} });
    });

    it("returns null when no connection found", async () => {
      const db = mockQuery(undefined);
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionByProvider("unknown");
      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      vi.mocked(getDb).mockImplementation(() => { throw new Error("db error"); });

      const result = await getConnectionByProvider("github");
      expect(result).toBeNull();
    });
  });

  // ───────────────────────────────────────────────
  // getConnectionSecrets
  // ───────────────────────────────────────────────
  describe("getConnectionSecrets", () => {
    it("returns decrypted secrets", async () => {
      const encBuf = Buffer.from("encrypted");
      const db = mockQuery({ accessTokenEnc: encBuf, isCurrent: true });
      vi.mocked(getDb).mockReturnValue(db as any);
      vi.mocked(decryptSecrets).mockReturnValue({ token: "abc123" } as any);

      const result = await getConnectionSecrets("conn-1");
      expect(decryptSecrets).toHaveBeenCalledWith(encBuf);
      expect(result).toEqual({ token: "abc123" });
    });

    it("returns null when no token found", async () => {
      const db = mockQuery(undefined);
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionSecrets("conn-1");
      expect(result).toBeNull();
    });

    it("returns null when accessTokenEnc is null", async () => {
      const db = mockQuery({ accessTokenEnc: null, isCurrent: true });
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionSecrets("conn-1");
      expect(result).toBeNull();
    });

    it("returns null on error", async () => {
      vi.mocked(getDb).mockImplementation(() => { throw new Error("db error"); });

      const result = await getConnectionSecrets("conn-1");
      expect(result).toBeNull();
    });
  });

  // ───────────────────────────────────────────────
  // getSelectedResources
  // ───────────────────────────────────────────────
  describe("getSelectedResources", () => {
    it("returns mapped resources with parsed metadata", async () => {
      const db = mockQuery([
        { id: "r1", connectionId: "c1", externalId: "ext-1", name: "Repo A", kind: "repository", metadata: '{"full_name":"org/repo"}' },
        { id: "r2", connectionId: "c1", externalId: "ext-2", name: null, kind: "board", metadata: null },
      ]);
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getSelectedResources("c1");
      expect(result).toEqual([
        { id: "r1", connectionId: "c1", externalId: "ext-1", name: "Repo A", kind: "repository", metadata: { full_name: "org/repo" } },
        { id: "r2", connectionId: "c1", externalId: "ext-2", name: "Untitled", kind: "board", metadata: {} },
      ]);
    });

    it("returns empty array when no resources", async () => {
      const db = mockQuery([]);
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getSelectedResources("c1");
      expect(result).toEqual([]);
    });

    it("returns empty array on error", async () => {
      vi.mocked(getDb).mockImplementation(() => { throw new Error("db error"); });

      const result = await getSelectedResources("c1");
      expect(result).toEqual([]);
    });

    it("passes kind filter when provided", async () => {
      const db = mockQuery([]);
      vi.mocked(getDb).mockReturnValue(db as any);

      await getSelectedResources("c1", "repository");
      // The where() was called (we can't easily inspect drizzle args, but we verify no error)
      expect(db.where).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────
  // getConnectionWithSecrets
  // ───────────────────────────────────────────────
  describe("getConnectionWithSecrets", () => {
    it("returns connection with secrets and metadata", async () => {
      // First call: getConnectionByProvider
      const db1 = mockQuery({ id: "conn-1", metadata: '{"domain":"x.com"}' });
      // Second call: getConnectionSecrets
      const db2 = mockQuery({ accessTokenEnc: Buffer.from("enc"), isCurrent: true });

      let callCount = 0;
      vi.mocked(getDb).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (db1 as any) : (db2 as any);
      });
      vi.mocked(decryptSecrets).mockReturnValue({ token: "secret" } as any);

      const result = await getConnectionWithSecrets("jira");
      expect(result).toEqual({
        id: "conn-1",
        secrets: { token: "secret" },
        metadata: { domain: "x.com" },
      });
    });

    it("returns null when connection not found", async () => {
      const db = mockQuery(undefined);
      vi.mocked(getDb).mockReturnValue(db as any);

      const result = await getConnectionWithSecrets("unknown");
      expect(result).toBeNull();
    });

    it("returns null when secrets not found", async () => {
      // getConnectionByProvider succeeds
      const db1 = mockQuery({ id: "conn-1", metadata: null });
      // getConnectionSecrets returns null
      const db2 = mockQuery(undefined);

      let callCount = 0;
      vi.mocked(getDb).mockImplementation(() => {
        callCount++;
        return callCount === 1 ? (db1 as any) : (db2 as any);
      });

      const result = await getConnectionWithSecrets("github");
      expect(result).toBeNull();
    });
  });

  // ───────────────────────────────────────────────
  // normalizeLimit
  // ───────────────────────────────────────────────
  describe("normalizeLimit", () => {
    it("returns value within range", () => {
      expect(normalizeLimit(50)).toBe(50);
    });

    it("clamps to min", () => {
      expect(normalizeLimit(0)).toBe(1);
      expect(normalizeLimit(-5)).toBe(1);
    });

    it("clamps to max", () => {
      expect(normalizeLimit(200)).toBe(100);
    });

    it("uses custom min/max", () => {
      expect(normalizeLimit(5, 10, 50)).toBe(10);
      expect(normalizeLimit(100, 10, 50)).toBe(50);
      expect(normalizeLimit(30, 10, 50)).toBe(30);
    });
  });

  // ───────────────────────────────────────────────
  // normalizeDateToIso
  // ───────────────────────────────────────────────
  describe("normalizeDateToIso", () => {
    it("returns current date ISO when no date provided", () => {
      const result = normalizeDateToIso();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("returns current date ISO for undefined", () => {
      const result = normalizeDateToIso(undefined);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("converts unix timestamp (seconds) to ISO", () => {
      // 2024-01-01T00:00:00.000Z = 1704067200
      const result = normalizeDateToIso(1704067200);
      expect(result).toBe("2024-01-01T00:00:00.000Z");
    });

    it("converts string date to ISO", () => {
      const result = normalizeDateToIso("2024-06-15");
      expect(result).toMatch(/^2024-06-15/);
    });

    it("converts Date object to ISO", () => {
      const date = new Date("2024-03-01T12:00:00Z");
      const result = normalizeDateToIso(date);
      expect(result).toBe("2024-03-01T12:00:00.000Z");
    });
  });

  // ───────────────────────────────────────────────
  // safeJsonParse
  // ───────────────────────────────────────────────
  describe("safeJsonParse", () => {
    it("parses valid JSON", () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it("returns fallback for null input", () => {
      expect(safeJsonParse(null)).toEqual({});
    });

    it("returns fallback for invalid JSON", () => {
      expect(safeJsonParse("not json")).toEqual({});
    });

    it("returns custom fallback", () => {
      expect(safeJsonParse(null, [])).toEqual([]);
      expect(safeJsonParse("bad", "default")).toBe("default");
    });

    it("parses arrays", () => {
      expect(safeJsonParse("[1,2,3]")).toEqual([1, 2, 3]);
    });
  });
});
