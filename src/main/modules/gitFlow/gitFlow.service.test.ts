import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("../workspace", () => ({
  workspaceService: {
    get: vi.fn(),
    deleteDiffs: vi.fn(),
    deleteFindingsByWorkspace: vi.fn(),
  },
  logWorkspaceActivity: vi.fn(),
  emitFindingsChanged: vi.fn(),
  recordWorkspaceDiff: vi.fn(),
}));

vi.mock("../git", () => ({
  gitService: {
    getCurrentBranch: vi.fn(),
    getRemotes: vi.fn(),
    stageFiles: vi.fn(),
    getStagedDiff: vi.fn(),
    commit: vi.fn(),
    getHeadSha: vi.fn(),
    push: vi.fn(),
  },
}));

vi.mock("../projects", () => ({
  projectsService: {
    get: vi.fn(),
  },
}));

vi.mock("../appSettings", () => ({
  appSettingsService: {
    getSettings: vi.fn(),
  },
}));

vi.mock("../runs/run-session-registry", () => ({
  runSessionRegistry: {
    get: vi.fn(),
  },
}));

import { gitFlowService } from "./gitFlow.service";
import { gitService } from "../git";
import { workspaceService } from "../workspace";

describe("gitFlowService — live branch invariants", () => {
  const gitMock = vi.mocked(gitService);
  const workspaceMock = vi.mocked(workspaceService);

  beforeEach(() => {
    vi.clearAllMocks();
    workspaceMock.get.mockResolvedValue({
      id: "ws-1",
      accountId: "default",
      projectId: null,
      name: "repo",
      rootPath: "/repo",
      repoUrl: "https://github.com/acme/repo.git",
      baseBranch: "main",
      metadata: null,
      status: "todo",
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    gitMock.getCurrentBranch.mockResolvedValue("feature/live");
    gitMock.getRemotes.mockResolvedValue([
      {
        name: "origin",
        fetchUrl: "https://github.com/acme/repo.git",
        pushUrl: "https://github.com/acme/repo.git",
      },
    ]);
    gitMock.push.mockResolvedValue({
      branch: "feature/live",
      remote: "origin",
    });
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: (
          error: Error | null,
          result: { stdout: string; stderr: string },
        ) => void,
      ) =>
        callback(null, {
          stdout: "https://github.com/acme/repo/pull/1\n",
          stderr: "",
        }),
    );
  });

  it("commits and pushes the branch captured at action start", async () => {
    gitMock.getStagedDiff.mockResolvedValue("diff");
    gitMock.commit.mockResolvedValue({
      hash: "abc123",
      summary: "1 changed, 1 insertions, 0 deletions",
    });
    gitMock.getHeadSha.mockRejectedValue(new Error("skip snapshot"));

    await gitFlowService.commit({
      workspaceId: "ws-1",
      message: "test",
      push: true,
    });

    expect(gitMock.commit).toHaveBeenCalledWith("/repo", "test");
    expect(gitMock.push).toHaveBeenCalledWith("/repo", {
      branch: "feature/live",
    });
  });

  it("pushes and opens the PR with one consistent live head and explicit base", async () => {
    await gitFlowService.createPr({
      workspaceId: "ws-1",
      title: "Live branch PR",
      body: "Body",
    });

    expect(gitMock.push).toHaveBeenCalledWith("/repo", {
      branch: "feature/live",
    });
    expect(execFileMock).toHaveBeenCalledWith(
      "gh",
      [
        "pr",
        "create",
        "--title",
        "Live branch PR",
        "--head",
        "feature/live",
        "--body",
        "Body",
        "--base",
        "main",
      ],
      {
        cwd: "/repo",
        timeout: 30_000,
      },
      expect.any(Function),
    );
  });

  it("rejects a PR whose live head equals its base before pushing", async () => {
    gitMock.getCurrentBranch.mockResolvedValue("main");

    await expect(
      gitFlowService.createPr({
        workspaceId: "ws-1",
        title: "Invalid PR",
      }),
    ).rejects.toThrow('Cannot create a pull request from "main" to itself');

    expect(gitMock.push).not.toHaveBeenCalled();
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
