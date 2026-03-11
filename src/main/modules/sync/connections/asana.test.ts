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
  fetchAsanaWorkspaces,
  fetchAsanaProjects,
  fetchAsanaTasks,
  fetchAsanaFromConnectionResources,
} from "./asana";

const mockGetConnectionWithSecrets = vi.mocked(getConnectionWithSecrets);
const mockGetSelectedResources = vi.mocked(getSelectedResources);

// ─── Helpers ────────────────────────────────────────────────

function makeConnection(overrides = {}) {
  return {
    id: "conn-1",
    secrets: { accessToken: "pat-123" },
    metadata: {},
    ...overrides,
  };
}

function makeResource(overrides = {}) {
  return {
    id: "res-1",
    connectionId: "conn-1",
    externalId: "proj-gid-1",
    name: "My Project",
    kind: "asana_project",
    metadata: {},
    ...overrides,
  };
}

function makeAsanaTask(overrides: Record<string, any> = {}) {
  return {
    gid: "111",
    name: "Design homepage",
    notes: "Some notes",
    permalink_url: "https://app.asana.com/0/111/222",
    created_at: "2025-02-01T08:00:00.000Z",
    modified_at: "2025-02-02T09:00:00.000Z",
    completed: false,
    completed_at: null,
    due_on: "2025-03-01",
    due_at: null,
    assignee: { gid: "u1", name: "Alice" },
    projects: [{ gid: "proj-gid-1", name: "My Project" }],
    workspace: { gid: "ws-1", name: "Acme" },
    tags: [{ gid: "t1", name: "urgent" }],
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

// ─── fetchAsanaFromConnectionResources ──────────────────────

describe("fetchAsanaFromConnectionResources", () => {
  it("returns [] when no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchAsanaFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("returns [] when no selected projects", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([]);

    const result = await fetchAsanaFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches tasks from selected projects", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([makeResource()]);
    mockFetch.mockResolvedValue(
      okJson({ data: [makeAsanaTask()], next_page: null })
    );

    const result = await fetchAsanaFromConnectionResources(10);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Design homepage");
    expect(result[0].kind).toBe("issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
  });
});

// ─── fetchAsanaWorkspaces ───────────────────────────────────

describe("fetchAsanaWorkspaces", () => {
  it("returns workspaces on success", async () => {
    const ws = [{ gid: "ws-1", name: "Acme" }];
    mockFetch.mockResolvedValue(okJson({ data: ws }));

    const result = await fetchAsanaWorkspaces("tok");
    expect(result).toEqual(ws);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(errorResponse(401));

    await expect(fetchAsanaWorkspaces("tok")).rejects.toThrow(
      "Asana API error: 401"
    );
  });

  it("throws when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("dns failure"));

    await expect(fetchAsanaWorkspaces("tok")).rejects.toThrow("dns failure");
  });
});

// ─── fetchAsanaProjects ─────────────────────────────────────

describe("fetchAsanaProjects", () => {
  it("returns non-archived projects", async () => {
    const projects = [
      { gid: "p1", name: "Active", archived: false },
      { gid: "p2", name: "Archived", archived: true },
    ];
    mockFetch.mockResolvedValue(okJson({ data: projects }));

    const result = await fetchAsanaProjects("tok");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Active");
  });

  it("passes workspaceGid param in URL", async () => {
    mockFetch.mockResolvedValue(okJson({ data: [] }));

    const result = await fetchAsanaProjects("tok", "ws-99");
    expect(result).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("workspace=ws-99"),
      expect.anything()
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(errorResponse(403));

    await expect(fetchAsanaProjects("tok")).rejects.toThrow(
      "Asana API error: 403"
    );
  });

  it("throws when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));

    await expect(fetchAsanaProjects("tok")).rejects.toThrow("timeout");
  });
});

// ─── fetchAsanaTasks ────────────────────────────────────────

describe("fetchAsanaTasks", () => {
  it("returns [] when no token and no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchAsanaTasks("proj-gid-1");
    expect(result).toEqual([]);
  });

  it("maps tasks to EntityInput on success", async () => {
    mockFetch.mockResolvedValue(
      okJson({ data: [makeAsanaTask()], next_page: null })
    );

    const result = await fetchAsanaTasks("proj-gid-1", 20, "conn-1", "res-1", "tok");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Design homepage");
    expect(result[0].url).toBe("https://app.asana.com/0/111/222");
    expect(result[0].body).toBe("Some notes");
    expect(result[0].externalId).toBe("proj-gid-1#111");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect((result[0].metadata as any).provider).toBe("asana");
    expect((result[0].metadata as any).assignee).toBe("Alice");
    expect((result[0].metadata as any).state).toBe("open");
    expect((result[0].metadata as any).labels).toEqual(["urgent"]);
  });

  it("returns [] on API non-ok", async () => {
    mockFetch.mockResolvedValue(errorResponse(500));

    const result = await fetchAsanaTasks("proj-gid-1", 20, "c", "r", "tok");
    expect(result).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("connection reset"));

    const result = await fetchAsanaTasks("proj-gid-1", 20, "c", "r", "tok");
    expect(result).toEqual([]);
  });
});
