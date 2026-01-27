import simpleGit, { SimpleGit, StatusResult, LogResult, RemoteWithRefs } from "simple-git";

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
}

export const gitService = new GitService();
