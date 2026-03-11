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
  fetchJiraProjects,
  fetchJiraIssues,
  fetchJiraFromConnectionResources,
} from "./jira";

const mockGetConnectionWithSecrets = vi.mocked(getConnectionWithSecrets);
const mockGetSelectedResources = vi.mocked(getSelectedResources);

// ─── Helpers ────────────────────────────────────────────────

function makeConnection(overrides = {}) {
  return {
    id: "conn-1",
    secrets: { apiToken: "tok-123" },
    metadata: { domain: "acme.atlassian.net", email: "user@acme.com" },
    ...overrides,
  };
}

function makeResource(overrides = {}) {
  return {
    id: "res-1",
    connectionId: "conn-1",
    externalId: "PROJ",
    name: "Project One",
    kind: "jira_project",
    metadata: {},
    ...overrides,
  };
}

function makeJiraIssue(overrides: Record<string, any> = {}) {
  return {
    id: "10001",
    key: "PROJ-1",
    self: "https://acme.atlassian.net/rest/api/3/issue/10001",
    fields: {
      summary: "Fix login bug",
      description: null,
      status: { name: "To Do", statusCategory: { key: "new" } },
      issuetype: { name: "Bug", iconUrl: "https://icon.png" },
      priority: { id: "3", name: "Medium" },
      assignee: { displayName: "Alice", emailAddress: "alice@acme.com" },
      reporter: { displayName: "Bob" },
      labels: ["frontend"],
      created: "2025-01-15T10:00:00.000Z",
      updated: "2025-01-16T12:00:00.000Z",
      duedate: null,
      project: { key: "PROJ", name: "Project One" },
      ...overrides,
    },
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

// ─── fetchJiraFromConnectionResources ───────────────────────

describe("fetchJiraFromConnectionResources", () => {
  it("returns [] when no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchJiraFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("returns [] when no selected projects", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([]);

    const result = await fetchJiraFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches issues from selected projects", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(makeConnection());
    mockGetSelectedResources.mockResolvedValue([makeResource()]);
    mockFetch.mockResolvedValue(
      okJson({ issues: [makeJiraIssue()], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraFromConnectionResources(10);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Fix login bug");
    expect(result[0].kind).toBe("issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
  });
});

// ─── fetchJiraProjects ──────────────────────────────────────

describe("fetchJiraProjects", () => {
  it("returns projects on success", async () => {
    const projects = [{ id: "1", key: "PROJ", name: "Proj", projectTypeKey: "software" }];
    mockFetch.mockResolvedValue(okJson({ values: projects }));

    const result = await fetchJiraProjects("acme.atlassian.net", "u@acme.com", "tok");
    expect(result).toEqual(projects);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue(errorResponse(403));

    await expect(
      fetchJiraProjects("acme.atlassian.net", "u@acme.com", "tok")
    ).rejects.toThrow("Jira API error: 403");
  });

  it("throws when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("network"));

    await expect(
      fetchJiraProjects("acme.atlassian.net", "u@acme.com", "tok")
    ).rejects.toThrow("network");
  });
});

// ─── fetchJiraIssues ────────────────────────────────────────

describe("fetchJiraIssues", () => {
  it("returns [] when no credentials and no connection", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchJiraIssues("PROJ");
    expect(result).toEqual([]);
  });

  it("maps issues with ADF description", async () => {
    const adfDesc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }],
        },
      ],
    };
    const issue = makeJiraIssue({ description: adfDesc });
    mockFetch.mockResolvedValue(
      okJson({ issues: [issue], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraIssues(
      "PROJ", 20, "conn-1", "res-1", "acme.atlassian.net", "u@acme.com", "tok"
    );
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("Hello world");
    expect(result[0].kind).toBe("issue");
    expect(result[0].externalId).toBe("PROJ-1");
  });

  it("maps issues with string description", async () => {
    const issue = makeJiraIssue({ description: "plain text desc" });
    mockFetch.mockResolvedValue(
      okJson({ issues: [issue], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraIssues(
      "PROJ", 20, "conn-1", "res-1", "acme.atlassian.net", "u@acme.com", "tok"
    );
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe("plain text desc");
  });

  it("maps issues with null description", async () => {
    const issue = makeJiraIssue({ description: null });
    mockFetch.mockResolvedValue(
      okJson({ issues: [issue], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraIssues(
      "PROJ", 20, "conn-1", "res-1", "acme.atlassian.net", "u@acme.com", "tok"
    );
    expect(result).toHaveLength(1);
    expect(result[0].body).toBeNull();
  });

  it("returns [] on API non-ok", async () => {
    mockFetch.mockResolvedValue(errorResponse(400));

    const result = await fetchJiraIssues(
      "PROJ", 20, "conn-1", "res-1", "acme.atlassian.net", "u@acme.com", "tok"
    );
    expect(result).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("timeout"));

    const result = await fetchJiraIssues(
      "PROJ", 20, "conn-1", "res-1", "acme.atlassian.net", "u@acme.com", "tok"
    );
    expect(result).toEqual([]);
  });
});

// ─── ADF extraction (via fetchJiraIssues mapping) ───────────

describe("ADF extraction", () => {
  it("extracts text from doc with paragraphs", async () => {
    const adf = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Line 1" }] },
        { type: "paragraph", content: [{ type: "text", text: "Line 2" }] },
      ],
    };
    const issue = makeJiraIssue({ description: adf });
    mockFetch.mockResolvedValue(
      okJson({ issues: [issue], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraIssues(
      "PROJ", 20, "c", "r", "d.atlassian.net", "e@d.com", "t"
    );
    expect(result[0].body).toBe("Line 1\nLine 2");
  });

  it("returns empty string for non-object ADF input", async () => {
    // A number as description — not a string and not an object, extractTextFromADF returns ""
    const issue = makeJiraIssue({ description: 42 as any });
    mockFetch.mockResolvedValue(
      okJson({ issues: [issue], total: 1, maxResults: 20, startAt: 0 })
    );

    const result = await fetchJiraIssues(
      "PROJ", 20, "c", "r", "d.atlassian.net", "e@d.com", "t"
    );
    // description is truthy (42) but not a string, so extractTextFromADF is called
    // extractTextFromADF(42) → "" because typeof 42 !== "object"
    expect(result[0].body).toBe("");
  });
});
