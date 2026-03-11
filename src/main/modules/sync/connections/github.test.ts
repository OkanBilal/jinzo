import { describe, it, expect, vi, beforeEach } from "vitest";


// Mock Octokit
const mockListForRepo = vi.fn();
const mockPullsList = vi.fn();

vi.mock("@octokit/rest", () => {
  return {
    Octokit: class {
      issues = { listForRepo: mockListForRepo };
      pulls = { list: mockPullsList };
    },
  };
});

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
  fetchIssues,
  fetchPullRequests,
  fetchGitHubFromConnectionResources,
} from "./github";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// fetchGitHubFromConnectionResources
// ─────────────────────────────────────────────────────────────
describe("fetchGitHubFromConnectionResources", () => {
  it("returns [] when no connection exists", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchGitHubFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("returns [] when no selected repos exist", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "ghp_test" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    const result = await fetchGitHubFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("skips repos with invalid identifiers (no slash)", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "ghp_test" },
    });
    mockGetSelectedResources.mockResolvedValue([
      {
        id: "res-1",
        connectionId: "conn-1",
        externalId: "no-slash-here",
        name: "bad-repo",
        metadata: {},
      },
    ]);

    const result = await fetchGitHubFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches issues and PRs for a single repo and returns combined results", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "ghp_test" },
    });
    mockGetSelectedResources.mockResolvedValue([
      {
        id: "res-1",
        connectionId: "conn-1",
        externalId: "octocat/hello-world",
        name: "hello-world",
        metadata: {},
      },
    ]);

    mockListForRepo.mockResolvedValue({
      data: [
        {
          title: "Bug report",
          html_url: "https://github.com/octocat/hello-world/issues/1",
          body: "Something broken",
          created_at: "2025-01-01T00:00:00Z",
          number: 1,
          state: "open",
          labels: ["bug"],
          assignee: { login: "octocat" },
        },
      ],
    });

    mockPullsList.mockResolvedValue({
      data: [
        {
          title: "Fix bug",
          html_url: "https://github.com/octocat/hello-world/pull/2",
          body: "Fixes #1",
          created_at: "2025-01-02T00:00:00Z",
          number: 2,
          state: "open",
          labels: [{ name: "fix" }],
          draft: false,
        },
      ],
    });

    const result = await fetchGitHubFromConnectionResources(10, 5);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Bug report");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect(result[1].kind).toBe("pull_request");
    expect(result[1].title).toBe("Fix bug");
  });

  it("fetches from multiple repos", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { token: "ghp_test" },
    });
    mockGetSelectedResources.mockResolvedValue([
      {
        id: "res-1",
        connectionId: "conn-1",
        externalId: "org/repo-a",
        name: "repo-a",
        metadata: {},
      },
      {
        id: "res-2",
        connectionId: "conn-1",
        externalId: "org/repo-b",
        name: "repo-b",
        metadata: {},
      },
    ]);

    mockListForRepo.mockResolvedValue({
      data: [
        {
          title: "Issue",
          html_url: "https://github.com/org/repo/issues/1",
          body: null,
          created_at: "2025-01-01T00:00:00Z",
          number: 1,
          state: "open",
          labels: [],
          assignee: null,
        },
      ],
    });
    mockPullsList.mockResolvedValue({ data: [] });

    const result = await fetchGitHubFromConnectionResources();
    expect(result).toHaveLength(2);
    expect(mockListForRepo).toHaveBeenCalledTimes(2);
    expect(mockPullsList).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchIssues
// ─────────────────────────────────────────────────────────────
describe("fetchIssues", () => {
  it("returns [] when no token is available", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchIssues("owner", "repo");
    expect(result).toEqual([]);
  });

  it("maps API issues to EntityInput and filters out pull_request items", async () => {
    mockListForRepo.mockResolvedValue({
      data: [
        {
          title: "Real issue",
          html_url: "https://github.com/owner/repo/issues/10",
          body: "Description here",
          created_at: "2025-06-01T12:00:00Z",
          number: 10,
          state: "open",
          labels: ["enhancement", { name: "priority" }],
          assignee: { login: "dev1" },
        },
        {
          title: "PR disguised as issue",
          html_url: "https://github.com/owner/repo/issues/11",
          body: "This is actually a PR",
          created_at: "2025-06-02T12:00:00Z",
          number: 11,
          state: "open",
          labels: [],
          assignee: null,
          pull_request: { url: "https://api.github.com/repos/owner/repo/pulls/11" },
        },
      ],
    });

    const result = await fetchIssues("owner", "repo", 10, "conn-1", "res-1", "ghp_token");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Real issue");
    expect(result[0].externalId).toBe("owner/repo#10");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect(result[0].body).toBe("Description here");
    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("github");
    expect(meta.labels).toEqual(["enhancement", "priority"]);
    expect(meta.assignee).toBe("dev1");
  });

  it("returns [] when the API throws", async () => {
    mockListForRepo.mockRejectedValue(new Error("Network error"));

    const result = await fetchIssues("owner", "repo", 5, undefined, undefined, "ghp_token");
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchPullRequests
// ─────────────────────────────────────────────────────────────
describe("fetchPullRequests", () => {
  it("returns [] when no token is available", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchPullRequests("owner", "repo");
    expect(result).toEqual([]);
  });

  it("maps API PRs to EntityInput", async () => {
    mockPullsList.mockResolvedValue({
      data: [
        {
          title: "Add feature",
          html_url: "https://github.com/owner/repo/pull/5",
          body: "New feature body",
          created_at: "2025-03-15T08:00:00Z",
          number: 5,
          state: "open",
          labels: [{ name: "feature" }],
          draft: true,
        },
      ],
    });

    const result = await fetchPullRequests("owner", "repo", 10, "conn-1", "res-1", "ghp_token");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("pull_request");
    expect(result[0].title).toBe("Add feature");
    expect(result[0].externalId).toBe("owner/repo#5");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    expect(result[0].body).toBe("New feature body");
    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("github");
    expect(meta.draft).toBe(true);
    expect(meta.labels).toEqual(["feature"]);
  });

  it("returns [] when the API throws", async () => {
    mockPullsList.mockRejectedValue(new Error("Rate limited"));

    const result = await fetchPullRequests("owner", "repo", 5, undefined, undefined, "ghp_token");
    expect(result).toEqual([]);
  });
});
