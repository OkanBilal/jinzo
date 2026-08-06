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
    getDiff: vi.fn(),
    commit: vi.fn(),
    getHeadSha: vi.fn(),
    push: vi.fn(),
  },
}));

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock("../providers/providers.service", () => ({
  providersService: {
    getById: vi.fn().mockResolvedValue({
      id: "claude_code",
      displayName: "Claude",
      defaultModel: "some-big-chat-model",
    }),
  },
}));

vi.mock("../providers/adapters/adapter.factory", () => ({
  createWorkAdapter: vi.fn(() => ({ generateText: generateTextMock })),
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

  describe("generateCommitMessage", () => {
    it("preview mode reads the diffs without staging and omits the model", async () => {
      gitMock.getStagedDiff.mockResolvedValue("staged-hunk");
      gitMock.getDiff.mockResolvedValue("working-hunk");
      generateTextMock.mockResolvedValue("feat: do the thing");

      const message = await gitFlowService.generateCommitMessage({
        workspaceId: "ws-1",
        providerId: "claude_code",
        preview: true,
      });

      expect(message).toBe("feat: do the thing");
      // Prefill must not mutate the index as a read side effect.
      expect(gitMock.stageFiles).not.toHaveBeenCalled();
      const [prompt, opts] = generateTextMock.mock.calls[0];
      expect(prompt).toContain("staged-hunk");
      expect(prompt).toContain("working-hunk");
      // No model → the driver's cheap one-shot default, not the chat model.
      expect(opts.model).toBeUndefined();
    });

    it("non-preview mode stages before reading the staged diff", async () => {
      gitMock.getStagedDiff.mockResolvedValue("staged-hunk");
      generateTextMock.mockResolvedValue("fix: stage first");

      await gitFlowService.generateCommitMessage({
        workspaceId: "ws-1",
        providerId: "claude_code",
      });

      expect(gitMock.stageFiles).toHaveBeenCalledWith("/repo");
      expect(gitMock.getDiff).not.toHaveBeenCalled();
    });
  });
});
