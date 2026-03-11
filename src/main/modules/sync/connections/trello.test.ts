import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("../sync.connection-utils", () => ({
  getConnectionWithSecrets: vi.fn(),
  getSelectedResources: vi.fn(),
  normalizeLimit: vi.fn((l: number, min: number, max: number) =>
    Math.max(min, Math.min(max, l))
  ),
  normalizeDateToIso: vi.fn((d: any) =>
    d ? new Date(d).toISOString() : new Date().toISOString()
  ),
}));

import {
  getConnectionWithSecrets,
  getSelectedResources,
} from "../sync.connection-utils";

import {
  fetchTrelloBoards,
  fetchTrelloCards,
  fetchTrelloFromConnectionResources,
} from "./trello";

const mockGetConnectionWithSecrets = vi.mocked(getConnectionWithSecrets);
const mockGetSelectedResources = vi.mocked(getSelectedResources);

// ─── Helpers ────────────────────────────────────────────────

function makeConnection(overrides = {}) {
  return {
    id: "conn-1",
    secrets: { token: "tok-abc", apiKey: "key-xyz" },
    metadata: {},
    ...overrides,
  };
}

function makeResource(overrides = {}) {
  return {
    id: "res-1",
    connectionId: "conn-1",
    externalId: "board-1",
    name: "Dev Board",
    kind: "trello_board",
    metadata: {},
    ...overrides,
  };
}

function makeTrelloCard(overrides: Record<string, any> = {}) {
  return {
    id: "card-id-1",
    name: "Implement auth",
    desc: "OAuth flow",
    shortUrl: "https://trello.com/c/abc",
    idShort: 42,
    shortLink: "abc",
    dateLastActivity: "2025-03-01T10:00:00.000Z",
    closed: false,
    due: null,
    dueComplete: false,
    labels: [{ id: "lbl1", name: "backend", color: "green" }],
    idMembers: ["m1"],
    idList: "list-1",
    ...overrides,
  };
}

function makeTrelloBoard(overrides: Record<string, any> = {}) {
  return {
    id: "board-1",
    name: "Dev Board",
    shortLink: "xyz",
    shortUrl: "https://trello.com/b/xyz",
    closed: false,
    desc: "Board desc",
    prefs: { background: "blue", backgroundColor: "#0079bf" },
    organization: { displayName: "Acme" },
    ...overrides,
  };
}

function okJson(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function errorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "server error",
  };
}

// ─── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── fetchTrelloFromConnectionResources ─────────────────────

describe("fetchTrelloFromConnectionResources", () => {
  it("returns [] when no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchTrelloFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("returns [] when no selected boards", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([]);

    const result = await fetchTrelloFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches cards from selected boards", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([makeResource()]);

    // First call: fetchBoardLists, second call: fetchTrelloCards
    mockFetch
      .mockResolvedValueOnce(
        okJson([{ id: "list-1", name: "To Do", closed: false }])
      )
      .mockResolvedValueOnce(okJson([makeTrelloCard()]));

    const result = await fetchTrelloFromConnectionResources(10);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Implement auth");
    expect(result[0].kind).toBe("issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
  });
});

// ─── fetchTrelloBoards ──────────────────────────────────────

describe("fetchTrelloBoards", () => {
  it("returns open boards (filters closed)", async () => {
    const boards = [
      makeTrelloBoard({ id: "b1", closed: false }),
      makeTrelloBoard({ id: "b2", closed: true }),
    ];
    mockFetch.mockResolvedValue(okJson(boards));

    const result = await fetchTrelloBoards("key", "tok");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(errorResponse(401));

    await expect(fetchTrelloBoards("key", "tok")).rejects.toThrow(
      "Trello API error: 401"
    );
  });

  it("throws when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    await expect(fetchTrelloBoards("key", "tok")).rejects.toThrow("network");
  });
});

// ─── fetchTrelloCards ───────────────────────────────────────

describe("fetchTrelloCards", () => {
  it("returns [] when no creds and no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchTrelloCards("board-1");
    expect(result).toEqual([]);
  });

  it("maps cards with list name from list map", async () => {
    // First call: lists endpoint
    mockFetch.mockResolvedValueOnce(
      okJson([{ id: "list-1", name: "In Progress", closed: false }])
    );
    // Second call: cards endpoint
    mockFetch.mockResolvedValueOnce(okJson([makeTrelloCard()]));

    const result = await fetchTrelloCards(
      "board-1", 50, "conn-1", "res-1", "tok", "key"
    );
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Implement auth");
    expect(result[0].url).toBe("https://trello.com/c/abc");
    expect(result[0].body).toBe("OAuth flow");
    expect(result[0].externalId).toBe("board-1#42");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect((result[0].metadata as any).provider).toBe("trello");
    expect((result[0].metadata as any).listName).toBe("In Progress");
    expect((result[0].metadata as any).labels).toEqual(["backend"]);
    expect((result[0].metadata as any).memberCount).toBe(1);
    expect((result[0].metadata as any).state).toBe("open");
  });

  it("returns [] on API non-ok", async () => {
    // lists call succeeds
    mockFetch.mockResolvedValueOnce(okJson([]));
    // cards call fails
    mockFetch.mockResolvedValueOnce(errorResponse(403));

    const result = await fetchTrelloCards(
      "board-1", 50, "conn-1", "res-1", "tok", "key"
    );
    expect(result).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));

    const result = await fetchTrelloCards(
      "board-1", 50, "conn-1", "res-1", "tok", "key"
    );
    expect(result).toEqual([]);
  });
});

// ─── Board lists ────────────────────────────────────────────

describe("board lists for list name mapping", () => {
  it("fetches lists and uses them for card mapping", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okJson([
          { id: "list-1", name: "Done", closed: false },
          { id: "list-2", name: "Backlog", closed: false },
        ])
      )
      .mockResolvedValueOnce(
        okJson([
          makeTrelloCard({ idList: "list-2" }),
        ])
      );

    const result = await fetchTrelloCards(
      "board-1", 50, "conn-1", "res-1", "tok", "key"
    );
    expect(result).toHaveLength(1);
    expect((result[0].metadata as any).listName).toBe("Backlog");
  });

  it("uses null list name when lists fetch fails (graceful)", async () => {
    // lists call fails
    mockFetch.mockResolvedValueOnce(errorResponse(500));
    // cards call succeeds
    mockFetch.mockResolvedValueOnce(okJson([makeTrelloCard()]));

    const result = await fetchTrelloCards(
      "board-1", 50, "conn-1", "res-1", "tok", "key"
    );
    expect(result).toHaveLength(1);
    // listMap is empty because lists returned non-ok, so listName is null
    expect((result[0].metadata as any).listName).toBeNull();
  });
});
