import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./connections", () => ({
  fetchGitHubFromConnectionResources: vi.fn(),
  fetchLinearFromConnectionResources: vi.fn(),
  fetchJiraFromConnectionResources: vi.fn(),
  fetchAsanaFromConnectionResources: vi.fn(),
  fetchGitlabFromConnectionResources: vi.fn(),
  fetchTrelloFromConnectionResources: vi.fn(),
}));

import { fetchAllEntities, FETCH_LIMITS } from "./sync.fetchers";
import {
  fetchGitHubFromConnectionResources,
  fetchLinearFromConnectionResources,
  fetchJiraFromConnectionResources,
  fetchAsanaFromConnectionResources,
  fetchGitlabFromConnectionResources,
  fetchTrelloFromConnectionResources,
} from "./connections";
import type { EntityInput } from "./sync.dto";

const mockEntity = (id: string): EntityInput => ({
  kind: "issue",
  title: `Entity ${id}`,
  url: `https://example.com/${id}`,
  body: null,
  summary: null,
  occurredAt: new Date().toISOString(),
  resourceId: id,
});

describe("sync.fetchers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all fetchers return empty
    vi.mocked(fetchGitHubFromConnectionResources).mockResolvedValue([]);
    vi.mocked(fetchLinearFromConnectionResources).mockResolvedValue([]);
    vi.mocked(fetchJiraFromConnectionResources).mockResolvedValue([]);
    vi.mocked(fetchAsanaFromConnectionResources).mockResolvedValue([]);
    vi.mocked(fetchGitlabFromConnectionResources).mockResolvedValue([]);
    vi.mocked(fetchTrelloFromConnectionResources).mockResolvedValue([]);
  });

  describe("FETCH_LIMITS", () => {
    it("has correct default limits", () => {
      expect(FETCH_LIMITS.GITHUB_ISSUES).toBe(50);
      expect(FETCH_LIMITS.GITHUB_PRS).toBe(50);
      expect(FETCH_LIMITS.GITLAB_ISSUES).toBe(50);
      expect(FETCH_LIMITS.GITLAB_MRS).toBe(50);
      expect(FETCH_LIMITS.LINEAR_ISSUES).toBe(50);
      expect(FETCH_LIMITS.JIRA_ISSUES).toBe(50);
      expect(FETCH_LIMITS.ASANA_TASKS).toBe(50);
      expect(FETCH_LIMITS.TRELLO_CARDS).toBe(50);
    });
  });

  describe("fetchAllEntities", () => {
    it("calls all 6 fetchers when no provider specified", async () => {
      const result = await fetchAllEntities();
      expect(result).toEqual([]);
      expect(fetchGitHubFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchGitlabFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchLinearFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchJiraFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchAsanaFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchTrelloFromConnectionResources).toHaveBeenCalledOnce();
    });

    it("passes correct limits to github fetcher", async () => {
      await fetchAllEntities("github");
      expect(fetchGitHubFromConnectionResources).toHaveBeenCalledWith(50, 50);
    });

    it("passes correct limits to gitlab fetcher", async () => {
      await fetchAllEntities("gitlab");
      expect(fetchGitlabFromConnectionResources).toHaveBeenCalledWith(50, 50);
    });

    it("passes correct limit to linear fetcher", async () => {
      await fetchAllEntities("linear");
      expect(fetchLinearFromConnectionResources).toHaveBeenCalledWith(50);
    });

    it("passes correct limit to jira fetcher", async () => {
      await fetchAllEntities("jira");
      expect(fetchJiraFromConnectionResources).toHaveBeenCalledWith(50);
    });

    it("passes correct limit to asana fetcher", async () => {
      await fetchAllEntities("asana");
      expect(fetchAsanaFromConnectionResources).toHaveBeenCalledWith(50);
    });

    it("passes correct limit to trello fetcher", async () => {
      await fetchAllEntities("trello");
      expect(fetchTrelloFromConnectionResources).toHaveBeenCalledWith(50);
    });

    it("only calls specified provider fetcher", async () => {
      await fetchAllEntities("github");
      expect(fetchGitHubFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchLinearFromConnectionResources).not.toHaveBeenCalled();
      expect(fetchJiraFromConnectionResources).not.toHaveBeenCalled();
      expect(fetchAsanaFromConnectionResources).not.toHaveBeenCalled();
      expect(fetchGitlabFromConnectionResources).not.toHaveBeenCalled();
      expect(fetchTrelloFromConnectionResources).not.toHaveBeenCalled();
    });

    it("falls back to all fetchers for unknown provider", async () => {
      const result = await fetchAllEntities("unknown_provider");
      expect(result).toEqual([]);
      expect(fetchGitHubFromConnectionResources).toHaveBeenCalledOnce();
      expect(fetchLinearFromConnectionResources).toHaveBeenCalledOnce();
    });

    it("flattens results from multiple fetchers", async () => {
      vi.mocked(fetchGitHubFromConnectionResources).mockResolvedValue([mockEntity("gh-1")]);
      vi.mocked(fetchLinearFromConnectionResources).mockResolvedValue([mockEntity("ln-1"), mockEntity("ln-2")]);

      const result = await fetchAllEntities();
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.resourceId)).toEqual(["gh-1", "ln-1", "ln-2"]);
    });

    it("returns entities from single provider", async () => {
      vi.mocked(fetchGitHubFromConnectionResources).mockResolvedValue([
        mockEntity("gh-1"),
        mockEntity("gh-2"),
      ]);

      const result = await fetchAllEntities("github");
      expect(result).toHaveLength(2);
    });

    it("returns empty array when all fetchers return empty", async () => {
      const result = await fetchAllEntities();
      expect(result).toEqual([]);
    });

    it("re-throws when a fetcher throws", async () => {
      vi.mocked(fetchGitHubFromConnectionResources).mockRejectedValue(new Error("API rate limit"));

      await expect(fetchAllEntities("github")).rejects.toThrow("API rate limit");
    });

    it("re-throws when any fetcher in all-providers mode throws", async () => {
      vi.mocked(fetchJiraFromConnectionResources).mockRejectedValue(new Error("Jira down"));

      await expect(fetchAllEntities()).rejects.toThrow("Jira down");
    });

    it("re-throws non-Error values", async () => {
      vi.mocked(fetchAsanaFromConnectionResources).mockRejectedValue("string error");

      await expect(fetchAllEntities("asana")).rejects.toBe("string error");
    });
  });
});
