import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock connection utils
const mockGetConnectionWithSecrets = vi.fn();
const mockGetSelectedResources = vi.fn();

vi.mock("../sync.connection-utils", () => ({
  getConnectionWithSecrets: (...args: any[]) => mockGetConnectionWithSecrets(...args),
  getSelectedResources: (...args: any[]) => mockGetSelectedResources(...args),
  normalizeLimit: vi.fn((l: number, min: number, max: number) =>
    Math.max(min, Math.min(max, l))
  ),
  normalizeDateToIso: vi.fn((d: any) =>
    d ? new Date(d).toISOString() : new Date().toISOString()
  ),
}));

import {
  fetchGitlabIssues,
  fetchGitlabMergeRequests,
  fetchGitlabFromConnectionResources,
} from "./gitlab";

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to create a mock fetch Response
function mockResponse(data: any, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

// ─────────────────────────────────────────────────────────────
// fetchGitlabFromConnectionResources
// ─────────────────────────────────────────────────────────────
describe("fetchGitlabFromConnectionResources", () => {
  it("returns [] when no connection exists", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchGitlabFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("returns [] when no selected projects exist", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "glpat-test" },
      metadata: { domain: "gitlab.com" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    const result = await fetchGitlabFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches issues and MRs from each project and returns combined results", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "glpat-test" },
      metadata: { domain: "gitlab.com" },
    });
    mockGetSelectedResources.mockResolvedValue([
      {
        id: "res-1",
        connectionId: "conn-1",
        externalId: "123",
        name: "my-project",
        metadata: {},
      },
    ]);

    // First call = issues, second call = MRs
    mockFetch
      .mockResolvedValueOnce(
        mockResponse([
          {
            title: "GL Issue",
            web_url: "https://gitlab.com/group/project/-/issues/1",
            description: "Issue body",
            created_at: "2025-05-01T00:00:00Z",
            iid: 1,
            state: "opened",
            labels: ["bug"],
            assignee: { username: "dev1" },
          },
        ])
      )
      .mockResolvedValueOnce(
        mockResponse([
          {
            title: "GL MR",
            web_url: "https://gitlab.com/group/project/-/merge_requests/2",
            description: "MR body",
            created_at: "2025-05-02T00:00:00Z",
            iid: 2,
            state: "opened",
            labels: [],
            draft: false,
            assignee: null,
          },
        ])
      );

    const result = await fetchGitlabFromConnectionResources(10, 5);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("GL Issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect(result[1].kind).toBe("merge_request");
    expect(result[1].title).toBe("GL MR");
  });
});

// ─────────────────────────────────────────────────────────────
// fetchGitlabIssues
// ─────────────────────────────────────────────────────────────
describe("fetchGitlabIssues", () => {
  it("returns [] when no token is provided", async () => {
    const result = await fetchGitlabIssues("123");
    expect(result).toEqual([]);
  });

  it("maps API issues to EntityInput with resolved body", async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          title: "Issue with image",
          web_url: "https://gitlab.com/group/project/-/issues/5",
          description:
            "See ![alt](/uploads/abc123/file.png){width=900 height=569}",
          created_at: "2025-04-10T10:00:00Z",
          iid: 5,
          state: "opened",
          labels: ["ui"],
          assignee: { username: "designer" },
        },
      ])
    );

    const result = await fetchGitlabIssues(
      "42",
      10,
      "conn-1",
      "res-1",
      "glpat-token",
      "gitlab.com"
    );
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Issue with image");
    expect(result[0].externalId).toBe("gitlab:42#5");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect(result[0].body).toBe(
      "See ![alt](https://gitlab.com/-/project/42/uploads/abc123/file.png)"
    );
    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("gitlab");
    expect(meta.labels).toEqual(["ui"]);
    expect(meta.assignee).toBe("designer");
  });

  it("returns [] when the API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue(mockResponse("Unauthorized", false, 401));

    const result = await fetchGitlabIssues("123", 10, undefined, undefined, "glpat-token");
    expect(result).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network failure"));

    const result = await fetchGitlabIssues("123", 10, undefined, undefined, "glpat-token");
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchGitlabMergeRequests
// ─────────────────────────────────────────────────────────────
describe("fetchGitlabMergeRequests", () => {
  it("returns [] when no token is provided", async () => {
    const result = await fetchGitlabMergeRequests("123");
    expect(result).toEqual([]);
  });

  it("maps API MRs to EntityInput", async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          title: "Refactor module",
          web_url: "https://gitlab.com/group/project/-/merge_requests/8",
          description: "Cleanup code",
          created_at: "2025-07-20T14:00:00Z",
          iid: 8,
          state: "opened",
          labels: ["refactor"],
          draft: true,
          assignee: { username: "eng1" },
        },
      ])
    );

    const result = await fetchGitlabMergeRequests(
      "99",
      5,
      "conn-2",
      "res-3",
      "glpat-mr",
      "gitlab.example.com"
    );
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("merge_request");
    expect(result[0].title).toBe("Refactor module");
    expect(result[0].externalId).toBe("gitlab:99!8");
    expect(result[0].connectionId).toBe("conn-2");
    expect(result[0].resourceId).toBe("res-3");
    expect(result[0].body).toBe("Cleanup code");
    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("gitlab");
    expect(meta.draft).toBe(true);
    expect(meta.labels).toEqual(["refactor"]);
    expect(meta.assignee).toBe("eng1");
  });

  it("returns [] when the API returns a non-ok response", async () => {
    mockFetch.mockResolvedValue(mockResponse("Forbidden", false, 403));

    const result = await fetchGitlabMergeRequests("123", 5, undefined, undefined, "glpat-token");
    expect(result).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("DNS resolution failed"));

    const result = await fetchGitlabMergeRequests("123", 5, undefined, undefined, "glpat-token");
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// Body resolution
// ─────────────────────────────────────────────────────────────
describe("body resolution", () => {
  it("converts relative upload paths to absolute URLs", async () => {
    mockFetch.mockResolvedValue(
      mockResponse([
        {
          title: "Image issue",
          web_url: "https://gitlab.com/g/p/-/issues/1",
          description: "![alt](/uploads/hash/file.png){width=900}",
          created_at: "2025-01-01T00:00:00Z",
          iid: 1,
          state: "opened",
          labels: [],
          assignee: null,
        },
      ])
    );

    const result = await fetchGitlabIssues("proj-1", 5, "c1", "r1", "tok", "gitlab.com");
    expect(result).toHaveLength(1);
    expect(result[0].body).toBe(
      "![alt](https://gitlab.com/-/project/proj-1/uploads/hash/file.png)"
    );
  });
});
