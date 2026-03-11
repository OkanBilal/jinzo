import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock LinearClient
const mockIssues = vi.fn();
const mockTeams = vi.fn();

vi.mock("@linear/sdk", () => ({
  LinearClient: class MockLinearClient {
    constructor() {
      return {
        teams: mockTeams,
        issues: mockIssues,
      };
    }
  },
}));

// Mock connection utils
const mockGetConnectionWithSecrets = vi.fn();
const mockGetSelectedResources = vi.fn();

vi.mock("../sync.connection-utils", () => ({
  getConnectionWithSecrets: (...args: any[]) =>
    mockGetConnectionWithSecrets(...args),
  getSelectedResources: (...args: any[]) =>
    mockGetSelectedResources(...args),
  normalizeLimit: vi.fn((l: number, min: number, max: number) =>
    Math.max(min, Math.min(max, l))
  ),
  normalizeDateToIso: vi.fn((d: any) =>
    d ? new Date(d).toISOString() : new Date().toISOString()
  ),
}));

import {
  fetchLinearIssues,
  fetchLinearFromConnectionResources,
} from "./linear";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// fetchLinearFromConnectionResources
// ─────────────────────────────────────────────────────────────
describe("fetchLinearFromConnectionResources", () => {
  it("returns [] when no connection exists", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchLinearFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("falls back to fetchAllLinearIssues when no teams selected", async () => {
    // getConnection() and getLinearClient() both call getConnectionWithSecrets
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { apiKey: "lin_test_key" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    // Mock the issues call for fetchAllLinearIssues path
    mockIssues.mockResolvedValue({
      nodes: [
        {
          id: "issue-all-1",
          title: "All Teams Issue",
          url: "https://linear.app/team/ALL-1",
          description: "from all teams",
          identifier: "ALL-1",
          createdAt: "2024-01-01",
          updatedAt: "2024-01-02",
          completedAt: null,
          priority: 1,
          state: Promise.resolve({ name: "Todo" }),
          assignee: Promise.resolve({ name: "Alice" }),
          labels: vi.fn().mockResolvedValue({ nodes: [] }),
          team: Promise.resolve({ key: "ALL" }),
        },
      ],
    });

    const result = await fetchLinearFromConnectionResources();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("All Teams Issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBeNull();
  });

  it("fetches issues per selected team", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { apiKey: "lin_test_key" },
    });
    mockGetSelectedResources.mockResolvedValue([
      {
        id: "res-1",
        connectionId: "conn-1",
        externalId: "ENG",
        name: "Engineering",
        metadata: {},
      },
    ]);

    const mockTeamNode = {
      issues: vi.fn().mockResolvedValue({
        nodes: [
          {
            id: "issue-1",
            title: "Test Issue",
            url: "https://linear.app/team/ENG-1",
            description: "desc",
            identifier: "ENG-1",
            createdAt: "2024-01-01",
            updatedAt: "2024-01-02",
            completedAt: null,
            priority: 2,
            state: Promise.resolve({ name: "In Progress" }),
            assignee: Promise.resolve({ name: "John" }),
            labels: vi.fn().mockResolvedValue({ nodes: [{ name: "bug" }] }),
          },
        ],
      }),
    };

    mockTeams.mockResolvedValue({ nodes: [mockTeamNode] });

    const result = await fetchLinearFromConnectionResources(10);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Test Issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");
    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("linear");
    expect(meta.teamKey).toBe("ENG");
    expect(meta.state).toBe("In Progress");
    expect(meta.assignee).toBe("John");
    expect(meta.labels).toEqual(["bug"]);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchLinearIssues
// ─────────────────────────────────────────────────────────────
describe("fetchLinearIssues", () => {
  it("returns [] when no token and no credentials", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue(null);

    const result = await fetchLinearIssues("ENG");
    expect(result).toEqual([]);
  });

  it("returns [] when team not found", async () => {
    mockTeams.mockResolvedValue({ nodes: [] });

    const result = await fetchLinearIssues("NOPE", 10, "conn-1", "res-1", "lin_test");
    expect(result).toEqual([]);
  });

  it("maps Linear issues to EntityInput", async () => {
    const mockIssue = {
      id: "issue-1",
      title: "Test Issue",
      url: "https://linear.app/team/TEST-1",
      description: "desc",
      identifier: "TEST-1",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-02",
      completedAt: null,
      priority: 2,
      state: Promise.resolve({ name: "In Progress" }),
      assignee: Promise.resolve({ name: "John" }),
      labels: vi.fn().mockResolvedValue({ nodes: [{ name: "bug" }] }),
    };

    const mockTeamNode = {
      issues: vi.fn().mockResolvedValue({ nodes: [mockIssue] }),
    };

    mockTeams.mockResolvedValue({ nodes: [mockTeamNode] });

    const result = await fetchLinearIssues("TEST", 10, "conn-1", "res-1", "lin_test");
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Test Issue");
    expect(result[0].url).toBe("https://linear.app/team/TEST-1");
    expect(result[0].body).toBe("desc");
    expect(result[0].externalId).toBe("issue-1");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBe("res-1");

    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.provider).toBe("linear");
    expect(meta.identifier).toBe("TEST-1");
    expect(meta.number).toBe(1);
    expect(meta.teamKey).toBe("TEST");
    expect(meta.state).toBe("In Progress");
    expect(meta.labels).toEqual(["bug"]);
    expect(meta.assignee).toBe("John");
    expect(meta.priority).toBe(2);
  });

  it("returns [] when API throws", async () => {
    mockTeams.mockRejectedValue(new Error("API error"));

    const result = await fetchLinearIssues("TEST", 10, "conn-1", "res-1", "lin_test");
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// fetchAllLinearIssues (exercised via fetchLinearFromConnectionResources)
// ─────────────────────────────────────────────────────────────
describe("fetchAllLinearIssues (via fetchLinearFromConnectionResources)", () => {
  it("returns [] when no issues found", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { apiKey: "lin_test" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    mockIssues.mockResolvedValue({
      nodes: [],
    });

    const result = await fetchLinearFromConnectionResources();
    expect(result).toEqual([]);
  });

  it("fetches issues without team filter", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { apiKey: "lin_test" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    mockIssues.mockResolvedValue({
      nodes: [
        {
          id: "issue-2",
          title: "Global Issue",
          url: "https://linear.app/team/PROJ-5",
          description: "global desc",
          identifier: "PROJ-5",
          createdAt: "2024-02-01",
          updatedAt: "2024-02-02",
          completedAt: null,
          priority: 3,
          state: Promise.resolve({ name: "Backlog" }),
          assignee: Promise.resolve(null),
          labels: vi.fn().mockResolvedValue({ nodes: [{ name: "feature" }] }),
          team: Promise.resolve({ key: "PROJ" }),
        },
      ],
    });

    const result = await fetchLinearFromConnectionResources(5);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("issue");
    expect(result[0].title).toBe("Global Issue");
    expect(result[0].connectionId).toBe("conn-1");
    expect(result[0].resourceId).toBeNull();

    const meta = result[0].metadata as Record<string, unknown>;
    expect(meta.teamKey).toBe("PROJ");
    expect(meta.state).toBe("Backlog");
    expect(meta.assignee).toBeNull();
    expect(meta.labels).toEqual(["feature"]);
  });

  it("returns [] when API throws", async () => {
    mockGetConnectionWithSecrets.mockResolvedValue({
      id: "conn-1",
      secrets: { apiKey: "lin_test" },
    });
    mockGetSelectedResources.mockResolvedValue([]);

    mockIssues.mockRejectedValue(new Error("Network failure"));

    const result = await fetchLinearFromConnectionResources();
    expect(result).toEqual([]);
  });
});
