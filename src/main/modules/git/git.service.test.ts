import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─────────────────────────────────────────────────────────────
// git module tests — real temporary repos, no simple-git mock.
//
// The interface is the test surface: semantics-bearing methods (three-dot
// branch diff, auto-upstream push, worktree import, snapshot synthesis) are
// exercised against actual git behavior. Pure pass-through methods get no
// dedicated tests. See CONTEXT.md "git test surface".
// ─────────────────────────────────────────────────────────────

// gitService reads app.getPath("userData") for the worktrees dir and
// app.getPath("desktop") for initRepo's default parent; point both at the
// test sandbox.
const paths = vi.hoisted(() => ({ base: "" }));
vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => path.join(paths.base, name),
  },
}));

import { gitService } from "./git.service";
import { hashContent, buildPerFileDiffHashes } from "./git-snapshot";

let sandbox: string;

/** Run git in a repo (isolated from the user's global/system config). */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

let repoCounter = 0;

/** Fresh repo on `main` with a committed README and a local identity. */
function makeRepo(): string {
  const repo = path.join(sandbox, `repo-${++repoCounter}`);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "test@mains.local");
  git(repo, "config", "user.name", "Mains Test");
  fs.writeFileSync(path.join(repo, "README.md"), "# test\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "init");
  return repo;
}

function write(repo: string, file: string, content: string): void {
  fs.writeFileSync(path.join(repo, file), content);
}

beforeAll(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "mains-git-test-"));
  paths.base = sandbox;
});

afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────
// captureDiffSnapshot
// ─────────────────────────────────────────────────────────────

describe("captureDiffSnapshot", () => {
  it("returns an empty snapshot for a clean tree", async () => {
    const repo = makeRepo();
    const head = await gitService.getHeadSha(repo);

    const snap = await gitService.captureDiffSnapshot(repo, head);

    expect(snap.baseRef).toBe(head);
    expect(snap.diffText).toBe("");
    expect(snap.files).toEqual([]);
    expect(snap.untrackedFiles).toEqual([]);
    expect(snap.shortstat).toBe("");
  });

  it("captures tracked modifications with shortstat", async () => {
    const repo = makeRepo();
    const head = await gitService.getHeadSha(repo);
    write(repo, "README.md", "# changed\n");

    const snap = await gitService.captureDiffSnapshot(repo, head);

    expect(snap.diffText).toContain("-# test");
    expect(snap.diffText).toContain("+# changed");
    expect(snap.files).toEqual(["README.md"]);
    expect(snap.untrackedFiles).toEqual([]);
    expect(snap.shortstat).toContain("1 file changed");
  });

  it("inlines small untracked files as synthetic hunks and merges the shortstat", async () => {
    const repo = makeRepo();
    const head = await gitService.getHeadSha(repo);
    write(repo, "new.txt", "hello\nworld\n");

    const snap = await gitService.captureDiffSnapshot(repo, head);

    expect(snap.diffText).toContain("diff --git a/new.txt b/new.txt");
    expect(snap.diffText).toContain("new file mode 100644");
    expect(snap.diffText).toContain("+hello");
    expect(snap.files).toContain("new.txt");
    expect(snap.untrackedFiles).toEqual(["new.txt"]);
    // git's shortstat omits untracked files; the snapshot merges them in.
    expect(snap.shortstat).toContain("1 file changed");
    expect(snap.shortstat).toMatch(/insertion/);
  });

  it("stubs large untracked files instead of inlining them", async () => {
    const repo = makeRepo();
    const head = await gitService.getHeadSha(repo);
    write(repo, "big.bin", "x".repeat(300 * 1024));

    const snap = await gitService.captureDiffSnapshot(repo, head);

    expect(snap.diffText).toContain("Binary or large file");
    expect(snap.diffText).not.toContain("+xxx");
    expect(snap.untrackedFiles).toEqual(["big.bin"]);
  });

  it("throws on an unknown baseRef instead of degrading to an empty diff (all-or-throw)", async () => {
    const repo = makeRepo();
    write(repo, "README.md", "# dirty\n");

    await expect(
      gitService.captureDiffSnapshot(repo, "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"),
    ).rejects.toThrow();
  });

  it("throws when the path is not a git repo", async () => {
    const dir = path.join(sandbox, "not-a-repo");
    fs.mkdirSync(dir, { recursive: true });

    await expect(gitService.captureDiffSnapshot(dir, "HEAD")).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// importLocalRepo / importLocalRepoDirect
// ─────────────────────────────────────────────────────────────

describe("importLocalRepo", () => {
  it("creates a branch + worktree under the project's worktrees dir", async () => {
    const repo = makeRepo();

    const result = await gitService.importLocalRepo(repo, {
      projectName: "myproj",
    });

    expect(result.baseBranch).toBe("main");
    expect(result.branchName).toBe(result.worktreeName);
    expect(result.worktreePath).toBe(
      path.join(sandbox, "userData", "worktrees", "myproj", result.worktreeName),
    );
    expect(fs.existsSync(path.join(result.worktreePath, "README.md"))).toBe(true);
    // The import branch exists in the source repo.
    expect(git(repo, "branch", "--list", result.branchName)).toContain(
      result.branchName,
    );
    expect(result.originUrl).toBeNull();
  });

  it("honors a custom branch name", async () => {
    const repo = makeRepo();

    const result = await gitService.importLocalRepo(repo, {
      projectName: "myproj",
      branchName: "my-branch",
    });

    expect(result.branchName).toBe("my-branch");
    expect(result.worktreeName).toBe("my-branch");
  });

  it("creates the worktree branch from the explicit base, not the source checkout", async () => {
    const repo = makeRepo();
    git(repo, "checkout", "-b", "source-feature");
    write(repo, "feature-only.txt", "feature\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "feature-only");

    const result = await gitService.importLocalRepo(repo, {
      projectName: "myproj",
      branchName: "from-main",
      baseBranch: "main",
    });

    expect(result.baseBranch).toBe("main");
    expect(fs.existsSync(path.join(result.worktreePath, "feature-only.txt"))).toBe(
      false,
    );
  });

  it("throws for a non-repo path", async () => {
    const dir = path.join(sandbox, "plain-dir");
    fs.mkdirSync(dir, { recursive: true });

    await expect(
      gitService.importLocalRepo(dir, { projectName: "p" }),
    ).rejects.toThrow(
      "Not a git repository",
    );
  });
});

describe("importLocalRepoDirect", () => {
  it("returns the active branch and origin metadata without creating a worktree", async () => {
    const repo = makeRepo();
    git(repo, "remote", "add", "origin", "https://github.com/foo/bar.git");

    const result = await gitService.importLocalRepoDirect(repo);

    expect(result.branchName).toBe("main");
    expect(result.baseBranch).toBe("main");
    expect(result.sourcePath).toBe(repo);
    expect(result.originUrl).toBe("https://github.com/foo/bar.git");
  });

  it("keeps the live checkout separate from the repository default branch", async () => {
    const repo = makeRepo();
    git(repo, "remote", "add", "origin", "https://github.com/foo/bar.git");
    git(repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
    git(repo, "checkout", "-b", "feature/live");

    const result = await gitService.importLocalRepoDirect(repo);

    expect(result.branchName).toBe("feature/live");
    expect(result.baseBranch).toBe("main");
  });
});

// ─────────────────────────────────────────────────────────────
// initRepo / cloneRepo
// ─────────────────────────────────────────────────────────────

describe("initRepo", () => {
  it("creates a fresh repo on main with an initial commit", async () => {
    const parent = path.join(sandbox, "init-parent");
    fs.mkdirSync(parent, { recursive: true });

    const result = await gitService.initRepo("fresh", parent);

    expect(result.rootPath).toBe(path.join(parent, "fresh"));
    expect(result.defaultBranch).toBe("main");
    expect(await gitService.getCurrentBranch(result.rootPath)).toBe("main");
    expect(git(result.rootPath, "log", "--oneline")).toContain("Initial commit");
  });

  it("throws when the folder already exists", async () => {
    const parent = path.join(sandbox, "init-parent-2");
    fs.mkdirSync(path.join(parent, "taken"), { recursive: true });

    await expect(gitService.initRepo("taken", parent)).rejects.toThrow(
      "Folder already exists",
    );
  });
});

describe("cloneRepo — URL hardening", () => {
  it("rejects option-injection and non-transport URLs", async () => {
    await expect(
      gitService.cloneRepo("-oProxyCommand=evil", sandbox),
    ).rejects.toThrow("Invalid repository URL");
    await expect(
      gitService.cloneRepo("file:///etc/passwd", sandbox),
    ).rejects.toThrow(/repository URLs are supported/);
    await expect(
      gitService.cloneRepo("/local/path", sandbox),
    ).rejects.toThrow(/repository URLs are supported/);
    await expect(
      gitService.cloneRepo("ext::sh -c whoami", sandbox),
    ).rejects.toThrow(/repository URLs are supported/);
  });
});

// ─────────────────────────────────────────────────────────────
// push — auto-upstream
// ─────────────────────────────────────────────────────────────

describe("push", () => {
  it("sets the upstream automatically when the branch has none", async () => {
    const origin = path.join(sandbox, "origin.git");
    fs.mkdirSync(origin);
    git(origin, "init", "--bare", "-b", "main");
    const repo = makeRepo();
    git(repo, "remote", "add", "origin", origin);

    const result = await gitService.push(repo);

    expect(result).toEqual({ branch: "main", remote: "origin" });
    // Upstream tracking is now configured…
    expect(git(repo, "rev-parse", "--abbrev-ref", "main@{upstream}")).toBe(
      "origin/main",
    );
    // …so a second push (new commit) succeeds without --set-upstream.
    write(repo, "b.txt", "b\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "second");
    await expect(gitService.push(repo)).resolves.toEqual({
      branch: "main",
      remote: "origin",
    });
  });

  it("throws when there is no remote", async () => {
    const repo = makeRepo();
    await expect(gitService.push(repo)).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// getBranchDiff / getBranchLog — base..HEAD semantics
// ─────────────────────────────────────────────────────────────

describe("getBranchDiff", () => {
  it("three-dot diff contains only the branch's own changes", async () => {
    const repo = makeRepo();
    // Branch work: change a.txt on feat.
    git(repo, "checkout", "-b", "feat");
    write(repo, "a.txt", "feat change\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "feat: a");
    // Base moves on independently: b.txt lands on main after divergence.
    git(repo, "checkout", "main");
    write(repo, "b.txt", "main change\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "main: b");
    git(repo, "checkout", "feat");

    const diff = await gitService.getBranchDiff(repo, "main");

    expect(diff).toContain("a.txt");
    // Two-dot would show main's b.txt as a deletion; three-dot must not.
    expect(diff).not.toContain("b.txt");
  });
});

describe("getBranchLog", () => {
  it("lists only commits unique to the branch", async () => {
    const repo = makeRepo();
    git(repo, "checkout", "-b", "feat");
    write(repo, "a.txt", "1\n");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "feat commit");

    const log = await gitService.getBranchLog(repo, "main");

    expect(log).toEqual(["feat commit"]);
  });
});

// ─────────────────────────────────────────────────────────────
// resetHard / renameBranch
// ─────────────────────────────────────────────────────────────

describe("resetHard", () => {
  it("discards tracked modifications and cleans untracked files", async () => {
    const repo = makeRepo();
    write(repo, "README.md", "# dirty\n");
    write(repo, "junk.txt", "junk\n");

    await gitService.resetHard(repo, "HEAD");

    const status = await gitService.getStatus(repo);
    expect(status.isClean).toBe(true);
    expect(fs.existsSync(path.join(repo, "junk.txt"))).toBe(false);
    expect(fs.readFileSync(path.join(repo, "README.md"), "utf-8")).toBe(
      "# test\n",
    );
  });

  it("rejects refs that would parse as git options", async () => {
    const repo = makeRepo();
    await expect(gitService.resetHard(repo, "--hard")).rejects.toThrow(
      "Invalid git ref",
    );
  });
});

describe("renameBranch", () => {
  it("renames the branch", async () => {
    const repo = makeRepo();

    await gitService.renameBranch(repo, "main", "trunk");

    expect(await gitService.getCurrentBranch(repo)).toBe("trunk");
  });
});

// ─────────────────────────────────────────────────────────────
// stage → staged diff → commit round-trip
// ─────────────────────────────────────────────────────────────

describe("stageFiles / getStagedDiff / commit", () => {
  it("stages everything, exposes the index diff, and commits it", async () => {
    const repo = makeRepo();
    write(repo, "c.txt", "content\n");

    await gitService.stageFiles(repo);
    const staged = await gitService.getStagedDiff(repo);
    expect(staged).toContain("c.txt");

    const result = await gitService.commit(repo, "add c");
    expect(result.hash).toBeTruthy();
    expect((await gitService.getStatus(repo)).isClean).toBe(true);
    expect(git(repo, "log", "-1", "--pretty=%s")).toBe("add c");
  });
});

// ─────────────────────────────────────────────────────────────
// getBranches — raw names (deduping is the caller's concern)
// ─────────────────────────────────────────────────────────────

describe("getBranches", () => {
  it("lists local branches with the current one", async () => {
    const repo = makeRepo();
    git(repo, "branch", "extra");

    const result = await gitService.getBranches(repo);

    expect(result.current).toBe("main");
    expect(result.all).toContain("main");
    expect(result.all).toContain("extra");
  });
});

// ─────────────────────────────────────────────────────────────
// Pure diff-text helpers
// ─────────────────────────────────────────────────────────────

describe("buildPerFileDiffHashes", () => {
  const chunk = (name: string, body: string) =>
    `diff --git a/${name} b/${name}\n--- a/${name}\n+++ b/${name}\n@@ -1 +1 @@\n${body}\n`;

  it("maps each file to a hash of its own chunk", () => {
    const diff = chunk("a.ts", "+x") + chunk("b.ts", "+y");
    const hashes = buildPerFileDiffHashes(diff);

    expect([...hashes.keys()]).toEqual(["a.ts", "b.ts"]);
    expect(hashes.get("a.ts")).toBe(hashContent(chunk("a.ts", "+x")));
    expect(hashes.get("a.ts")).not.toBe(hashes.get("b.ts"));
  });

  it("returns an empty map for empty input", () => {
    expect(buildPerFileDiffHashes("").size).toBe(0);
  });
});
