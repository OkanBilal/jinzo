import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Mock simple-git
// ─────────────────────────────────────────────────────────────

const mockGitInstance = {
  checkIsRepo: vi.fn(),
  revparse: vi.fn(),
  branch: vi.fn(),
  status: vi.fn(),
  log: vi.fn(),
  getRemotes: vi.fn(),
  diff: vi.fn(),
  raw: vi.fn(),
  checkoutLocalBranch: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  clone: vi.fn(),
};

vi.mock("simple-git", () => ({
  default: vi.fn(() => mockGitInstance),
}));

// Mock fs
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { gitService } from "./git.service";
import fs from "fs";

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("GitService", () => {
  const TEST_PATH = "/tmp/test-repo";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── isGitRepo ──────────────────────────────────────────────

  describe("isGitRepo", () => {
    it("returns true when path is a git repo", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);

      const result = await gitService.isGitRepo(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("returns false when path is not a git repo", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(false);

      const result = await gitService.isGitRepo(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it("returns error on failure", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue(new Error("Not a directory"));

      const result = await gitService.isGitRepo(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not a directory");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue("string error");

      const result = await gitService.isGitRepo(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to check git repo");
    });
  });

  // ─── getCurrentBranch ───────────────────────────────────────

  describe("getCurrentBranch", () => {
    it("returns the current branch name trimmed", async () => {
      mockGitInstance.revparse.mockResolvedValue("  main  \n");

      const result = await gitService.getCurrentBranch(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe("main");
    });

    it("returns error on failure", async () => {
      mockGitInstance.revparse.mockRejectedValue(new Error("detached HEAD"));

      const result = await gitService.getCurrentBranch(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("detached HEAD");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.revparse.mockRejectedValue(42);

      const result = await gitService.getCurrentBranch(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get current branch");
    });
  });

  // ─── getBranches ────────────────────────────────────────────

  describe("getBranches", () => {
    it("returns branch info", async () => {
      const branchSummary = {
        current: "main",
        all: ["main", "feature/test"],
        branches: {
          main: { current: true, name: "main", commit: "abc123", label: "main" },
          "feature/test": { current: false, name: "feature/test", commit: "def456", label: "feature/test" },
        },
      };
      mockGitInstance.branch.mockResolvedValue(branchSummary);

      const result = await gitService.getBranches(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        current: "main",
        all: ["main", "feature/test"],
        branches: branchSummary.branches,
      });
    });

    it("returns error on failure", async () => {
      mockGitInstance.branch.mockRejectedValue(new Error("git error"));

      const result = await gitService.getBranches(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("git error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.branch.mockRejectedValue(null);

      const result = await gitService.getBranches(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get branches");
    });
  });

  // ─── getStatus ──────────────────────────────────────────────

  describe("getStatus", () => {
    it("returns full status info", async () => {
      const mockStatus = {
        isClean: () => false,
        current: "main",
        tracking: "origin/main",
        ahead: 1,
        behind: 0,
        staged: ["file1.ts"],
        modified: ["file2.ts"],
        deleted: [],
        not_added: ["file3.ts"],
        conflicted: [],
      };
      mockGitInstance.status.mockResolvedValue(mockStatus);

      const result = await gitService.getStatus(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        isClean: false,
        current: "main",
        tracking: "origin/main",
        ahead: 1,
        behind: 0,
        staged: ["file1.ts"],
        modified: ["file2.ts"],
        deleted: [],
        untracked: ["file3.ts"],
        conflicted: [],
      });
    });

    it("returns clean status", async () => {
      const mockStatus = {
        isClean: () => true,
        current: "main",
        tracking: "origin/main",
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        deleted: [],
        not_added: [],
        conflicted: [],
      };
      mockGitInstance.status.mockResolvedValue(mockStatus);

      const result = await gitService.getStatus(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data!.isClean).toBe(true);
    });

    it("returns error on failure", async () => {
      mockGitInstance.status.mockRejectedValue(new Error("status failed"));

      const result = await gitService.getStatus(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("status failed");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.status.mockRejectedValue(undefined);

      const result = await gitService.getStatus(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get git status");
    });
  });

  // ─── getLog ─────────────────────────────────────────────────

  describe("getLog", () => {
    it("returns log entries with default limit", async () => {
      const mockLog = {
        all: [
          { hash: "abc123", date: "2024-01-01", message: "init", author_name: "User", author_email: "u@e.com" },
          { hash: "def456", date: "2024-01-02", message: "second", author_name: "User", author_email: "u@e.com" },
        ],
      };
      mockGitInstance.log.mockResolvedValue(mockLog);

      const result = await gitService.getLog(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].hash).toBe("abc123");
      expect(result.data![1].message).toBe("second");
      expect(mockGitInstance.log).toHaveBeenCalledWith({ maxCount: 10 });
    });

    it("respects custom limit", async () => {
      mockGitInstance.log.mockResolvedValue({ all: [] });

      const result = await gitService.getLog(TEST_PATH, 5);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockGitInstance.log).toHaveBeenCalledWith({ maxCount: 5 });
    });

    it("returns error on failure", async () => {
      mockGitInstance.log.mockRejectedValue(new Error("log failed"));

      const result = await gitService.getLog(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("log failed");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.log.mockRejectedValue(false);

      const result = await gitService.getLog(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get git log");
    });
  });

  // ─── getRemotes ─────────────────────────────────────────────

  describe("getRemotes", () => {
    it("returns remotes with fetch and push URLs", async () => {
      const mockRemotes = [
        { name: "origin", refs: { fetch: "https://github.com/user/repo.git", push: "git@github.com:user/repo.git" } },
        { name: "upstream", refs: { fetch: "https://github.com/org/repo.git", push: undefined } },
      ];
      mockGitInstance.getRemotes.mockResolvedValue(mockRemotes);

      const result = await gitService.getRemotes(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { name: "origin", fetchUrl: "https://github.com/user/repo.git", pushUrl: "git@github.com:user/repo.git" },
        { name: "upstream", fetchUrl: "https://github.com/org/repo.git", pushUrl: undefined },
      ]);
      expect(mockGitInstance.getRemotes).toHaveBeenCalledWith(true);
    });

    it("returns empty array when no remotes", async () => {
      mockGitInstance.getRemotes.mockResolvedValue([]);

      const result = await gitService.getRemotes(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.getRemotes.mockRejectedValue(new Error("no remotes"));

      const result = await gitService.getRemotes(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("no remotes");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.getRemotes.mockRejectedValue({});

      const result = await gitService.getRemotes(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get remotes");
    });
  });

  // ─── getDiff ────────────────────────────────────────────────

  describe("getDiff", () => {
    it("returns diff for all files when no filePath given", async () => {
      mockGitInstance.diff.mockResolvedValue("diff --git a/file.ts\n+added line");

      const result = await gitService.getDiff(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe("diff --git a/file.ts\n+added line");
      expect(mockGitInstance.diff).toHaveBeenCalledWith();
    });

    it("returns diff for a specific file", async () => {
      mockGitInstance.diff.mockResolvedValue("diff for file.ts");

      const result = await gitService.getDiff(TEST_PATH, "file.ts");
      expect(result.success).toBe(true);
      expect(result.data).toBe("diff for file.ts");
      expect(mockGitInstance.diff).toHaveBeenCalledWith(["file.ts"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.diff.mockRejectedValue(new Error("diff error"));

      const result = await gitService.getDiff(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("diff error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.diff.mockRejectedValue(0);

      const result = await gitService.getDiff(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get diff");
    });
  });

  // ─── getHeadSha ─────────────────────────────────────────────

  describe("getHeadSha", () => {
    it("returns trimmed HEAD sha", async () => {
      mockGitInstance.revparse.mockResolvedValue("abc123def456\n");

      const result = await gitService.getHeadSha(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe("abc123def456");
      expect(mockGitInstance.revparse).toHaveBeenCalledWith(["HEAD"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.revparse.mockRejectedValue(new Error("no HEAD"));

      const result = await gitService.getHeadSha(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("no HEAD");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.revparse.mockRejectedValue(null);

      const result = await gitService.getHeadSha(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get HEAD sha");
    });
  });

  // ─── getDiffSince ──────────────────────────────────────────

  describe("getDiffSince", () => {
    it("returns diff since base sha", async () => {
      mockGitInstance.diff.mockResolvedValue("diff since base");

      const result = await gitService.getDiffSince(TEST_PATH, "abc123");
      expect(result.success).toBe(true);
      expect(result.data).toBe("diff since base");
      expect(mockGitInstance.diff).toHaveBeenCalledWith(["abc123"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.diff.mockRejectedValue(new Error("bad sha"));

      const result = await gitService.getDiffSince(TEST_PATH, "invalid");
      expect(result.success).toBe(false);
      expect(result.error).toBe("bad sha");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.diff.mockRejectedValue(undefined);

      const result = await gitService.getDiffSince(TEST_PATH, "abc");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get diff since base");
    });
  });

  // ─── getChangedFilesSince ───────────────────────────────────

  describe("getChangedFilesSince", () => {
    it("returns list of changed files", async () => {
      mockGitInstance.diff.mockResolvedValue("file1.ts\nfile2.ts\nfile3.ts\n");

      const result = await gitService.getChangedFilesSince(TEST_PATH, "abc123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual(["file1.ts", "file2.ts", "file3.ts"]);
      expect(mockGitInstance.diff).toHaveBeenCalledWith(["--name-only", "abc123"]);
    });

    it("filters empty lines and trims whitespace", async () => {
      mockGitInstance.diff.mockResolvedValue("  file1.ts  \n\n  file2.ts \n\n");

      const result = await gitService.getChangedFilesSince(TEST_PATH, "abc123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual(["file1.ts", "file2.ts"]);
    });

    it("returns empty array when no changes", async () => {
      mockGitInstance.diff.mockResolvedValue("");

      const result = await gitService.getChangedFilesSince(TEST_PATH, "abc123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.diff.mockRejectedValue(new Error("diff error"));

      const result = await gitService.getChangedFilesSince(TEST_PATH, "abc123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("diff error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.diff.mockRejectedValue(123);

      const result = await gitService.getChangedFilesSince(TEST_PATH, "abc");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get changed files");
    });
  });

  // ─── getShortStatSince ──────────────────────────────────────

  describe("getShortStatSince", () => {
    it("returns trimmed shortstat", async () => {
      mockGitInstance.diff.mockResolvedValue("  3 files changed, 10 insertions(+), 2 deletions(-)  \n");

      const result = await gitService.getShortStatSince(TEST_PATH, "abc123");
      expect(result.success).toBe(true);
      expect(result.data).toBe("3 files changed, 10 insertions(+), 2 deletions(-)");
      expect(mockGitInstance.diff).toHaveBeenCalledWith(["--shortstat", "abc123"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.diff.mockRejectedValue(new Error("stat error"));

      const result = await gitService.getShortStatSince(TEST_PATH, "abc");
      expect(result.success).toBe(false);
      expect(result.error).toBe("stat error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.diff.mockRejectedValue(null);

      const result = await gitService.getShortStatSince(TEST_PATH, "abc");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get shortstat");
    });
  });

  // ─── getUntrackedFiles ─────────────────────────────────────

  describe("getUntrackedFiles", () => {
    it("returns list of untracked files", async () => {
      mockGitInstance.raw.mockResolvedValue("new-file.ts\nanother.ts\n");

      const result = await gitService.getUntrackedFiles(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(["new-file.ts", "another.ts"]);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(["ls-files", "--others", "--exclude-standard"]);
    });

    it("returns empty array when no untracked files", async () => {
      mockGitInstance.raw.mockResolvedValue("");

      const result = await gitService.getUntrackedFiles(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.raw.mockRejectedValue(new Error("ls-files error"));

      const result = await gitService.getUntrackedFiles(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("ls-files error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.raw.mockRejectedValue(undefined);

      const result = await gitService.getUntrackedFiles(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get untracked files");
    });
  });

  // ─── getRepoRoot ───────────────────────────────────────────

  describe("getRepoRoot", () => {
    it("returns trimmed repo root", async () => {
      mockGitInstance.revparse.mockResolvedValue("/home/user/project\n");

      const result = await gitService.getRepoRoot(TEST_PATH);
      expect(result.success).toBe(true);
      expect(result.data).toBe("/home/user/project");
      expect(mockGitInstance.revparse).toHaveBeenCalledWith(["--show-toplevel"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.revparse.mockRejectedValue(new Error("not a repo"));

      const result = await gitService.getRepoRoot(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("not a repo");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.revparse.mockRejectedValue(null);

      const result = await gitService.getRepoRoot(TEST_PATH);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get repo root");
    });
  });

  // ─── getWorktreesDir ───────────────────────────────────────

  describe("getWorktreesDir", () => {
    it("returns worktrees directory path", () => {
      const dir = gitService.getWorktreesDir();
      // electron mock returns /tmp/jinzo-test/userData
      expect(dir).toContain("worktrees");
      expect(typeof dir).toBe("string");
    });
  });

  // ─── createBranch ──────────────────────────────────────────

  describe("createBranch", () => {
    it("creates a branch and returns its name", async () => {
      mockGitInstance.checkoutLocalBranch.mockResolvedValue(undefined);

      const result = await gitService.createBranch(TEST_PATH, "feature/new");
      expect(result.success).toBe(true);
      expect(result.data).toBe("feature/new");
      expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalledWith("feature/new");
    });

    it("returns error on failure", async () => {
      mockGitInstance.checkoutLocalBranch.mockRejectedValue(new Error("branch exists"));

      const result = await gitService.createBranch(TEST_PATH, "feature/new");
      expect(result.success).toBe(false);
      expect(result.error).toBe("branch exists");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.checkoutLocalBranch.mockRejectedValue(null);

      const result = await gitService.createBranch(TEST_PATH, "x");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create branch");
    });
  });

  // ─── createWorktree ────────────────────────────────────────

  describe("createWorktree", () => {
    it("creates worktree and returns its path", async () => {
      mockGitInstance.raw.mockResolvedValue("");

      const result = await gitService.createWorktree(TEST_PATH, "/tmp/wt", "feature/new");
      expect(result.success).toBe(true);
      expect(result.data).toBe("/tmp/wt");
      expect(mockGitInstance.raw).toHaveBeenCalledWith(["worktree", "add", "/tmp/wt", "feature/new"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.raw.mockRejectedValue(new Error("worktree error"));

      const result = await gitService.createWorktree(TEST_PATH, "/tmp/wt", "branch");
      expect(result.success).toBe(false);
      expect(result.error).toBe("worktree error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.raw.mockRejectedValue(false);

      const result = await gitService.createWorktree(TEST_PATH, "/tmp/wt", "b");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create worktree");
    });
  });

  // ─── importLocalRepo ───────────────────────────────────────

  describe("importLocalRepo", () => {
    it("imports a local repo with worktree creation", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([
        { name: "origin", refs: { fetch: "https://github.com/user/repo.git", push: "git@github.com:user/repo.git" } },
      ]);
      mockGitInstance.raw.mockResolvedValue("");
      mockGitInstance.status.mockResolvedValue({
        tracking: "origin/main",
        ahead: 0,
        behind: 0,
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.baseBranch).toBe("main");
      expect(result.data!.originUrl).toBe("https://github.com/user/repo.git");
      expect(result.data!.branchName).toBeTruthy();
      expect(result.data!.worktreePath).toContain("worktrees");
      expect(result.data!.worktreeName).toBe(result.data!.branchName);
      expect(result.data!.tracking).toBe("origin/main");
      expect(result.data!.ahead).toBe(0);
      expect(result.data!.behind).toBe(0);
    });

    it("creates worktrees directory if it does not exist", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([]);
      mockGitInstance.raw.mockResolvedValue("");
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it("uses project name subfolder when provided", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([]);
      mockGitInstance.raw.mockResolvedValue("");
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await gitService.importLocalRepo("/source/path", "my-project");
      expect(result.success).toBe(true);
      expect(result.data!.worktreePath).toContain("my-project");
    });

    it("returns error when path is not a git repo", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(false);

      const result = await gitService.importLocalRepo("/not-a-repo");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not a git repository");
    });

    it("handles missing remotes gracefully (originUrl null)", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockRejectedValue(new Error("no remotes"));
      mockGitInstance.raw.mockResolvedValue("");
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.originUrl).toBeNull();
    });

    it("handles remotes without origin", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([
        { name: "upstream", refs: { fetch: "https://github.com/org/repo.git" } },
      ]);
      mockGitInstance.raw.mockResolvedValue("");
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.originUrl).toBeNull();
    });

    it("returns error on unexpected failure", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue(new Error("disk error"));

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(false);
      expect(result.error).toBe("disk error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue(42);

      const result = await gitService.importLocalRepo("/source/path");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to import local repo");
    });
  });

  // ─── importLocalRepoDirect ─────────────────────────────────

  describe("importLocalRepoDirect", () => {
    it("imports a local repo directly without worktree", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("develop\n");
      mockGitInstance.getRemotes.mockResolvedValue([
        { name: "origin", refs: { fetch: "https://github.com/user/repo.git", push: "git@github.com:user/repo.git" } },
      ]);
      mockGitInstance.status.mockResolvedValue({
        tracking: "origin/develop",
        ahead: 2,
        behind: 1,
      });

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        branchName: "develop",
        sourcePath: "/source/path",
        baseBranch: "develop",
        tracking: "origin/develop",
        ahead: 2,
        behind: 1,
        originUrl: "https://github.com/user/repo.git",
      });
    });

    it("returns error when path is not a git repo", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(false);

      const result = await gitService.importLocalRepoDirect("/not-a-repo");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not a git repository");
    });

    it("handles missing remotes gracefully", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockRejectedValue(new Error("no remotes"));
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.originUrl).toBeNull();
    });

    it("handles remotes without origin entry", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([
        { name: "upstream", refs: { fetch: "https://github.com/org/repo.git" } },
      ]);
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.originUrl).toBeNull();
    });

    it("uses push URL when fetch URL is missing", async () => {
      mockGitInstance.checkIsRepo.mockResolvedValue(true);
      mockGitInstance.revparse.mockResolvedValue("main\n");
      mockGitInstance.getRemotes.mockResolvedValue([
        { name: "origin", refs: { fetch: undefined, push: "git@github.com:user/repo.git" } },
      ]);
      mockGitInstance.status.mockResolvedValue({ tracking: null, ahead: 0, behind: 0 });

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(true);
      expect(result.data!.originUrl).toBe("git@github.com:user/repo.git");
    });

    it("returns error on unexpected failure", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue(new Error("disk error"));

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(false);
      expect(result.error).toBe("disk error");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.checkIsRepo.mockRejectedValue(null);

      const result = await gitService.importLocalRepoDirect("/source/path");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to import local repo");
    });
  });

  // ─── cloneRepo ─────────────────────────────────────────────

  describe("cloneRepo", () => {
    it("clones a repo and returns metadata", async () => {
      mockGitInstance.clone.mockResolvedValue(undefined);
      mockGitInstance.revparse.mockResolvedValue("main\n");

      const result = await gitService.cloneRepo(
        "https://github.com/user/my-repo.git",
        "/tmp/clones"
      );
      expect(result.success).toBe(true);
      expect(result.data!.clonedPath).toBe("/tmp/clones/my-repo");
      expect(result.data!.defaultBranch).toBe("main");
      expect(result.data!.originUrl).toBe("https://github.com/user/my-repo.git");
    });

    it("strips .git suffix from repo name", async () => {
      mockGitInstance.clone.mockResolvedValue(undefined);
      mockGitInstance.revparse.mockResolvedValue("main\n");

      const result = await gitService.cloneRepo(
        "https://github.com/user/project.git",
        "/tmp"
      );
      expect(result.success).toBe(true);
      expect(result.data!.clonedPath).toBe("/tmp/project");
    });

    it("handles URL without .git suffix", async () => {
      mockGitInstance.clone.mockResolvedValue(undefined);
      mockGitInstance.revparse.mockResolvedValue("main\n");

      const result = await gitService.cloneRepo(
        "https://github.com/user/project",
        "/tmp"
      );
      expect(result.success).toBe(true);
      expect(result.data!.clonedPath).toBe("/tmp/project");
    });

    it("returns error on clone failure", async () => {
      mockGitInstance.clone.mockRejectedValue(new Error("auth failed"));

      const result = await gitService.cloneRepo(
        "https://github.com/user/repo.git",
        "/tmp"
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("auth failed");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.clone.mockRejectedValue(undefined);

      const result = await gitService.cloneRepo("url", "/tmp");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to clone repository");
    });
  });

  // ─── stageFiles ────────────────────────────────────────────

  describe("stageFiles", () => {
    it("stages specific files", async () => {
      mockGitInstance.add.mockResolvedValue(undefined);

      await gitService.stageFiles(TEST_PATH, ["file1.ts", "file2.ts"]);
      expect(mockGitInstance.add).toHaveBeenCalledWith(["file1.ts", "file2.ts"]);
    });

    it("stages all files when no files provided", async () => {
      mockGitInstance.add.mockResolvedValue(undefined);

      await gitService.stageFiles(TEST_PATH);
      expect(mockGitInstance.add).toHaveBeenCalledWith("-A");
    });

    it("stages all files when empty array provided", async () => {
      mockGitInstance.add.mockResolvedValue(undefined);

      await gitService.stageFiles(TEST_PATH, []);
      expect(mockGitInstance.add).toHaveBeenCalledWith("-A");
    });

    it("throws on failure (no try-catch in stageFiles)", async () => {
      mockGitInstance.add.mockRejectedValue(new Error("stage error"));

      await expect(gitService.stageFiles(TEST_PATH, ["f.ts"])).rejects.toThrow("stage error");
    });
  });

  // ─── commit ────────────────────────────────────────────────

  describe("commit", () => {
    it("commits and returns hash and summary", async () => {
      mockGitInstance.commit.mockResolvedValue({
        commit: "abc123",
        summary: { changes: 3, insertions: 10, deletions: 2 },
      });

      const result = await gitService.commit(TEST_PATH, "feat: add feature");
      expect(result.hash).toBe("abc123");
      expect(result.summary).toBe("3 changed, 10 insertions, 2 deletions");
      expect(mockGitInstance.commit).toHaveBeenCalledWith("feat: add feature");
    });

    it("returns empty hash when commit is falsy", async () => {
      mockGitInstance.commit.mockResolvedValue({
        commit: "",
        summary: { changes: 0, insertions: 0, deletions: 0 },
      });

      const result = await gitService.commit(TEST_PATH, "empty commit");
      expect(result.hash).toBe("");
      expect(result.summary).toBe("0 changed, 0 insertions, 0 deletions");
    });

    it("throws on failure (no try-catch in commit)", async () => {
      mockGitInstance.commit.mockRejectedValue(new Error("commit error"));

      await expect(gitService.commit(TEST_PATH, "msg")).rejects.toThrow("commit error");
    });
  });

  // ─── removeWorktree ────────────────────────────────────────

  describe("removeWorktree", () => {
    it("removes worktree successfully", async () => {
      mockGitInstance.raw.mockResolvedValue("");

      const result = await gitService.removeWorktree(TEST_PATH, "/tmp/wt");
      expect(result.success).toBe(true);
      expect(mockGitInstance.raw).toHaveBeenCalledWith(["worktree", "remove", "/tmp/wt", "--force"]);
    });

    it("returns error on failure", async () => {
      mockGitInstance.raw.mockRejectedValue(new Error("worktree not found"));

      const result = await gitService.removeWorktree(TEST_PATH, "/tmp/wt");
      expect(result.success).toBe(false);
      expect(result.error).toBe("worktree not found");
    });

    it("returns fallback error for non-Error throws", async () => {
      mockGitInstance.raw.mockRejectedValue(undefined);

      const result = await gitService.removeWorktree(TEST_PATH, "/tmp/wt");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to remove worktree");
    });
  });
});
