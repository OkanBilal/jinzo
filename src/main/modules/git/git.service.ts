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

export interface DirectImportResult {
  branchName: string;
  sourcePath: string;
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

import { ok, fail, type ServiceResponse } from "../../../shared/ipc-kit/service-response";
export type { ServiceResponse };

// ─────────────────────────────────────────────────────────────
// Argument hardening
// ─────────────────────────────────────────────────────────────

// Transports like ext:: ("ext::sh -c ...") and fd:: execute arbitrary commands;
// file:// and bare local paths turn "clone" into local filesystem reads.
const SAFE_CLONE_URL =
  /^(https?:\/\/|ssh:\/\/|git:\/\/|[A-Za-z0-9._-]+@[A-Za-z0-9._~-]+:)/;

function validateCloneUrl(url: string): string | null {
  if (!url || url.startsWith("-")) return "Invalid repository URL";
  if (!SAFE_CLONE_URL.test(url)) {
    return "Only https://, ssh://, git:// or user@host: repository URLs are supported";
  }
  return null;
}

// A ref starting with "-" would be parsed as an option by git, not a revision.
function validateRef(ref: string): string | null {
  if (!ref || ref.startsWith("-") || /[\s\0]/.test(ref)) return "Invalid git ref";
  return null;
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
      return ok(isRepo);
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
      return ok(branch.trim());
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

      return ok(entries);
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

      return ok(result);
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

      return ok(diff);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get diff",
      };
    }
  }

  /**
   * Diff of the current branch against `baseRef`, three-dot style
   * (`git diff base...HEAD`) — i.e. only the changes the branch introduced
   * since it diverged from the base, which is exactly what a PR would show.
   * Independent of the working tree, so it works after the branch is committed
   * and clean.
   */
  async getBranchDiff(
    rootPath: string,
    baseRef: string,
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const diff = await git.diff([`${baseRef}...HEAD`]);
      return ok(diff);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to get branch diff",
      );
    }
  }

  /**
   * Commit subject lines unique to the current branch (`git log base..HEAD`),
   * i.e. excluding the base branch's own history. Used to summarize a PR.
   */
  async getBranchLog(
    rootPath: string,
    baseRef: string,
    limit = 20,
  ): Promise<ServiceResponse<string[]>> {
    try {
      const git = this.getGit(rootPath);
      const raw = await git.raw([
        "log",
        `${baseRef}..HEAD`,
        "--pretty=%s",
        "-n",
        String(limit),
      ]);
      const messages = raw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return ok(messages);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to get branch log",
      );
    }
  }

  /**
   * Get the staged (index) diff — i.e. `git diff --cached`. This is exactly
   * what the next commit will record, so it's the input we feed the model when
   * generating a commit message.
   */
  async getStagedDiff(rootPath: string): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const diff = await git.diff(["--cached"]);
      return ok(diff);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to get staged diff",
      );
    }
  }

  /**
   * Get HEAD commit sha
   */
  async getHeadSha(rootPath: string): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const sha = await git.revparse(["HEAD"]);
      return ok(sha.trim());
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get HEAD sha",
      };
    }
  }

  /**
   * Get unified diff since a base commit (includes both staged and unstaged changes)
   */
  async getDiffSince(
    rootPath: string,
    baseSha: string
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const diff = await git.diff([baseSha]);
      return ok(diff);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get diff since base",
      };
    }
  }

  /**
   * Get list of changed files since a base commit
   */
  async getChangedFilesSince(
    rootPath: string,
    baseSha: string
  ): Promise<ServiceResponse<string[]>> {
    try {
      const git = this.getGit(rootPath);
      const raw = await git.diff(["--name-only", baseSha]);
      const files = raw
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
      return ok(files);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get changed files",
      };
    }
  }

  /**
   * Get shortstat summary since a base commit
   */
  async getShortStatSince(
    rootPath: string,
    baseSha: string
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      const stat = await git.diff(["--shortstat", baseSha]);
      return ok(stat.trim());
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get shortstat",
      };
    }
  }

  /**
   * Get untracked files (new files not yet staged)
   */
  async getUntrackedFiles(rootPath: string): Promise<ServiceResponse<string[]>> {
    try {
      const git = this.getGit(rootPath);
      const raw = await git.raw(["ls-files", "--others", "--exclude-standard"]);
      const files = raw
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
      return ok(files);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get untracked files",
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
      return ok(root.trim());
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
      "grape", "orange", "pineapple", "strawberry", "watermelon",
      "kiwi", "blueberry", "raspberry", "lemon", "lime",
      "papaya", "plum", "pear", "coconut", "avocado"
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
      return ok(branchName);
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
      return ok(worktreePath);
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
  //TOD: ADD CLONE FROM REMOTE URL LATER, FOR NOW ONLY LOCAL PATH IMPORT
  async importLocalRepo(sourcePath: string, projectName?: string, customBranchName?: string): Promise<ServiceResponse<WorktreeImportResult>> {
    try {
      const git = this.getGit(sourcePath);

      // 1. Validate it's a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return fail("Not a git repository");
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

      // 4. Generate a single name for both branch and worktree (or use custom name)
      const fruitName = customBranchName || this.generateFruitName();
      const branchName = fruitName;
      const worktreeName = fruitName;

      // 5. Create the import branch (staying in source repo)
      await git.raw(["branch", branchName]);

      // 6. Create worktree directory under project subfolder if projectName provided
      const worktreesDir = projectName
        ? path.join(this.getWorktreesDir(), projectName)
        : this.getWorktreesDir();
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
   * Import a local git repo without creating a worktree.
   * Uses the source path and active branch directly.
   */
  async importLocalRepoDirect(sourcePath: string): Promise<ServiceResponse<DirectImportResult>> {
    try {
      const git = this.getGit(sourcePath);

      // 1. Validate it's a git repo
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return fail("Not a git repository");
      }

      // 2. Get current branch
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

      // 4. Get tracking info
      const status: StatusResult = await git.status();

      return {
        success: true,
        data: {
          branchName: baseBranch,
          sourcePath,
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
   * Create a new empty repo: mkdir under parentPath (defaults to user Desktop),
   * git init on `main`, seed README, commit. Errors if the folder already exists.
   */
  async initRepo(
    projectName: string,
    parentPath?: string
  ): Promise<ServiceResponse<{ rootPath: string; defaultBranch: string }>> {
    const targetParent = parentPath ?? app.getPath("desktop");
    const rootPath = path.join(targetParent, projectName);
    let createdFolder = false;
    try {
      if (fs.existsSync(rootPath)) {
        return fail("Folder already exists");
      }
      fs.mkdirSync(rootPath, { recursive: false });
      createdFolder = true;

      const git = this.getGit(rootPath);
      await git.init(false, ["--initial-branch=main"]);

      fs.writeFileSync(path.join(rootPath, "README.md"), `# ${projectName}\n`);
      await git.add(".");
      try {
        await git.commit("Initial commit");
      } catch {
        // Fallback when the user has no global git identity configured.
        await git.raw([
          "-c",
          "user.email=mains@local",
          "-c",
          "user.name=Mains",
          "commit",
          "-m",
          "Initial commit",
        ]);
      }

      return ok({ rootPath, defaultBranch: "main" });
    } catch (error) {
      if (createdFolder) {
        try {
          fs.rmSync(rootPath, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize repository",
      };
    }
  }

  /**
   * Clone a remote git repository to a local path
   */
  async cloneRepo(
    url: string,
    targetPath: string
  ): Promise<ServiceResponse<{ clonedPath: string; defaultBranch: string; originUrl: string }>> {
    try {
      const urlError = validateCloneUrl(url);
      if (urlError) return fail(urlError);

      // Extract repo name from URL for the folder name
      const repoName = url
        .replace(/\.git$/, "")
        .split("/")
        .pop() || "repo";
      const clonePath = path.join(targetPath, repoName);

      // Clone using simple-git (not bound to any repo yet)
      const git = simpleGit();
      await git.clone(url, clonePath);

      // Get the default branch from the cloned repo
      const clonedGit = this.getGit(clonePath);
      const defaultBranch = (await clonedGit.revparse(["--abbrev-ref", "HEAD"])).trim();

      return {
        success: true,
        data: {
          clonedPath: clonePath,
          defaultBranch,
          originUrl: url,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clone repository",
      };
    }
  }

  /**
   * Stage files for commit
   */
  async stageFiles(rootPath: string, files?: string[]): Promise<void> {
    const git = this.getGit(rootPath);
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add("-A");
    }
  }

  /**
   * Commit staged changes
   */
  async commit(rootPath: string, message: string): Promise<{ hash: string; summary: string }> {
    const git = this.getGit(rootPath);
    const result = await git.commit(message);
    return {
      hash: result.commit || "",
      summary: `${result.summary.changes} changed, ${result.summary.insertions} insertions, ${result.summary.deletions} deletions`,
    };
  }

  /**
   * Push the current branch to a remote. When the branch has no upstream yet
   * (common in fresh worktrees, even after the first commit), pushes with
   * `--set-upstream` so subsequent pushes work without arguments.
   */
  async push(
    rootPath: string,
    options?: { setUpstream?: boolean; remote?: string; branch?: string },
  ): Promise<ServiceResponse<{ branch: string; remote: string }>> {
    try {
      const git = this.getGit(rootPath);
      const remote = options?.remote ?? "origin";
      const branch =
        options?.branch ??
        (await git.revparse(["--abbrev-ref", "HEAD"])).trim();

      // Set upstream when explicitly asked, or when the branch isn't tracking
      // a remote yet — otherwise a bare `git push` would error.
      let setUpstream = options?.setUpstream ?? false;
      if (!setUpstream) {
        const status = await git.status();
        if (!status.tracking) setUpstream = true;
      }

      const args = setUpstream
        ? ["--set-upstream", remote, branch]
        : [remote, branch];
      await git.push(args);
      return ok({ branch, remote });
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to push",
      );
    }
  }

  /**
   * Add a new remote to the repository (e.g. `origin` when publishing a repo
   * that was created locally with no remote). Fails if the remote name already
   * exists, so callers should check `getRemotes` first when that matters.
   */
  async addRemote(
    rootPath: string,
    name: string,
    url: string,
  ): Promise<ServiceResponse<void>> {
    try {
      const git = this.getGit(rootPath);
      await git.addRemote(name, url);
      return ok(undefined);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to add remote",
      );
    }
  }

  /**
   * Rename a local branch
   */
  async renameBranch(
    rootPath: string,
    oldName: string,
    newName: string
  ): Promise<ServiceResponse<string>> {
    try {
      const git = this.getGit(rootPath);
      await git.raw(["branch", "-m", oldName, newName]);
      return ok(newName);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to rename branch",
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
      return ok(undefined);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove worktree",
      };
    }
  }
  /**
   * Hard-reset the working tree to a given ref and clean untracked files
   */
  async resetHard(
    rootPath: string,
    ref: string
  ): Promise<ServiceResponse<void>> {
    try {
      const refError = validateRef(ref);
      if (refError) return fail(refError);

      const git = this.getGit(rootPath);
      await git.reset(["--hard", ref]);
      await git.clean("f", ["-d"]);
      return ok(undefined);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to reset",
      };
    }
  }
}

export const gitService = new GitService();
