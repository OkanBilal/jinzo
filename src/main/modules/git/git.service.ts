import simpleGit, { SimpleGit, StatusResult, LogResult, RemoteWithRefs } from "simple-git";
import { app } from "electron";
import path from "path";
import fs from "fs";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface GitStatusResponse {
  isClean: boolean;
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  deleted: string[];
  untracked: string[];
  conflicted: string[];
}

export interface WorktreeImportResult {
  branchName: string;
  worktreePath: string;
  worktreeName: string;
  baseBranch: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  originUrl: string | null;
}

export interface GitBranchInfo {
  current: string;
  all: string[];
  branches: Record<string, { current: boolean; name: string; commit: string; label: string }>;
}

export interface GitLogEntry {
  hash: string;
  date: string;
  message: string;
  author_name: string;
  author_email: string;
}

export interface GitRemote {
  name: string;
  fetchUrl: string | undefined;
  pushUrl: string | undefined;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Git Service
// ─────────────────────────────────────────────────────────────

class GitService {
  private getGit(rootPath: string): SimpleGit {
    return simpleGit(rootPath);
  }

  /**
   * Check if a path is a git repository
   */
  async isGitRepo(rootPath: string): Promise<ServiceResponse<boolean>> {
    try {
      const git = this.getGit(rootPath);
      const isRepo = await git.checkIsRepo();
      return { success: true, data: isRepo };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check git repo",
      };
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(rootPath: string): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
      return { success: true, data: branch.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get current branch",
      };
    }
  }

  /**
   * Get all branches
   */
  async getBranches(rootPath: string): Promise<ServiceResponse<GitBranchInfo>> {
    try {
      const git = this.getGit(rootPath);
      const branchSummary = await git.branch();
      return {
        success: true,
        data: {
          current: branchSummary.current,
          all: branchSummary.all,
          branches: branchSummary.branches,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get branches",
      };
    }
  }

  /**
   * Get git status
   */
  async getStatus(rootPath: string): Promise<ServiceResponse<GitStatusResponse>> {
    try {
      const git = this.getGit(rootPath);
      const status: StatusResult = await git.status();

      return {
        success: true,
        data: {
          isClean: status.isClean(),
          current: status.current,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged,
          modified: status.modified,
          deleted: status.deleted,
          untracked: status.not_added,
          conflicted: status.conflicted,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get git status",
      };
    }
  }

  /**
   * Get git log (recent commits)
   */
  async getLog(
    rootPath: string,
    limit: number = 10
  ): Promise<ServiceResponse<GitLogEntry[]>> {
    try {
      const git = this.getGit(rootPath);
      const log: LogResult = await git.log({ maxCount: limit });

      const entries: GitLogEntry[] = log.all.map((entry) => ({
        hash: entry.hash,
        date: entry.date,
        message: entry.message,
        author_name: entry.author_name,
        author_email: entry.author_email,
      }));

      return { success: true, data: entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get git log",
      };
    }
  }

  /**
   * Get remotes
   */
  async getRemotes(rootPath: string): Promise<ServiceResponse<GitRemote[]>> {
    try {
      const git = this.getGit(rootPath);
      const remotes: RemoteWithRefs[] = await git.getRemotes(true);

      const result: GitRemote[] = remotes.map((remote) => ({
        name: remote.name,
        fetchUrl: remote.refs.fetch,
        pushUrl: remote.refs.push,
      }));

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get remotes",
      };
    }
  }

  /**
   * Get diff for a file or all files
   */
  async getDiff(
    rootPath: string,
    filePath?: string
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const diff = filePath
        ? await git.diff([filePath])
        : await git.diff();

      return { success: true, data: diff };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get diff",
      };
    }
  }

  /**
   * Get the root directory of the git repository
   */
  async getRepoRoot(rootPath: string): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const root = await git.revparse(["--show-toplevel"]);
      return { success: true, data: root.trim() };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get repo root",
      };
    }
  }

  /**
   * Get the worktrees directory path under app data
   */
  getWorktreesDir(): string {
    const userDataPath = app?.getPath("userData") || path.join(process.cwd(), ".data");
    return path.join(userDataPath, "worktrees");
  }

  /**
   * Generate a unique name using fruit + random suffix for both branch and worktree
   */
  private generateFruitName(): string {
    const fruits = [
      "apple", "banana", "cherry", "mango", "peach",
      "grape", "orange", "pineapple", "strawberry", "watermelon"
    ];
    const fruit = fruits[Math.floor(Math.random() * fruits.length)];
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${fruit}-${suffix}`;
  }

  /**
   * Create a new local branch
   */
  async createBranch(rootPath: string, branchName: string): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      await git.checkoutLocalBranch(branchName);
      return { success: true, data: branchName };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create branch",
      };
    }
  }

  /**
   * Create a worktree for a branch
   */
  async createWorktree(
    rootPath: string,
    worktreePath: string,
    branchName: string
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      await git.raw(["worktree", "add", worktreePath, branchName]);
      return { success: true, data: worktreePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create worktree",
      };
    }
  }

  /**
   * Import a local git repo by creating a branch + worktree
   * Returns full metadata needed for workspace creation
   */
  async importLocalRepo(sourcePath: string): Promise<ServiceResponse<WorktreeImportResult>> {
    try {
      const git = this.getGit(sourcePath);

      // 1. Validate it's a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return { success: false, error: "Not a git repository" };
      }

      // 2. Get current branch (baseBranch)
      const baseBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();

      // 3. Get origin URL if available
      let originUrl: string | null = null;
      try {
        const remotes: RemoteWithRefs[] = await git.getRemotes(true);
        const origin = remotes.find((r) => r.name === "origin");
        if (origin) {
          originUrl = origin.refs.fetch || origin.refs.push || null;
        }
      } catch {
        // No remotes, that's fine
      }

      // 4. Generate a single name for both branch and worktree
      const fruitName = this.generateFruitName();
      const branchName = fruitName;
      const worktreeName = fruitName;

      // 5. Create the import branch (staying in source repo)
      await git.raw(["branch", branchName]);

      // 6. Create worktree directory
      const worktreesDir = this.getWorktreesDir();
      if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
      }

      const worktreePath = path.join(worktreesDir, worktreeName);

      // 7. Create the worktree
      await git.raw(["worktree", "add", worktreePath, branchName]);

      // 8. Now get tracking info from the worktree context
      const wGit = this.getGit(worktreePath);
      const status: StatusResult = await wGit.status();

      return {
        success: true,
        data: {
          branchName,
          worktreePath,
          worktreeName,
          baseBranch,
          tracking: status.tracking,
          ahead: status.ahead,
          behind: status.behind,
          originUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import local repo",
      };
    }
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(
    sourcePath: string,
    worktreePath: string
  ): Promise<ServiceResponse<void>> {
    try {
      const git = this.getGit(sourcePath);
      await git.raw(["worktree", "remove", worktreePath, "--force"]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove worktree",
      };
    }
  }
}

export const gitService = new GitService();
