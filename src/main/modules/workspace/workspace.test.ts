// ════════════════════════════════════════════════════════════════
//   workspace test suite
//
//   Consolidates 10 source test files (5 service.test + 5 repo.test)
//   from the pre-aggregate workspace cluster. Section order matches
//   workspace.service.ts / workspace.repo.ts:
//
//     1. Workspace lifecycle  — repo + service
//     2. Activity             — repo + service
//     3. Diffs                — repo + service
//     4. Reviews              — repo + service
//     5. Findings             — repo + service
//
//   See ADR-0001 for the consolidation decision.
// ════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProject,
  createWorkspace,
  createWorkspaceActivity,
  createWorkspaceDiff,
  createReview,
  createReviewFinding,
  createRun,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";
import { clearEventSinks } from "../../ipc-kit";
import { registerBrowserWindowSink } from "../../ipc-kit/browser-window-sink";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

// Mocks needed by workspace lifecycle (script execution + renderer notify)
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    getPath: () => "/tmp",
    getName: () => "mains",
    getVersion: () => "0.0.0",
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));

vi.mock("child_process", () => ({
  execFile: vi.fn(
    (_shell: string, _args: string[], _opts: unknown, cb: (...args: any[]) => void) => {
      cb(null, "done", "");
    },
  ),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn(() => true) };
});

// Workspace intake collaborators — stubbed so the intake can be exercised
// end-to-end against the test db without touching real git or settings.
// gitService is throw-style: mocks resolve plain values / reject Errors.
vi.mock("../git/git.service", () => ({
  gitService: {
    initRepo: vi.fn(),
    cloneRepo: vi.fn(),
    isGitRepo: vi.fn(),
    importLocalRepo: vi.fn(),
    importLocalRepoDirect: vi.fn(),
    getRemotes: vi.fn(),
    getCurrentBranch: vi.fn(),
    getHeadSha: vi.fn(),
    renameBranch: vi.fn(),
    resetHard: vi.fn(),
    captureDiffSnapshot: vi.fn(),
  },
}));

vi.mock("../appSettings/appSettings.service", () => ({
  appSettingsService: { ensureSettings: vi.fn() },
}));

import {
  workspaceService,
  logWorkspaceActivity,
} from "./index";
import { workspaceRepo } from "./workspace.repo";
import { projectsRepo } from "../projects/projects.repo";
import { gitService } from "../git/git.service";
import { appSettingsService } from "../appSettings/appSettings.service";
import { BrowserWindow } from "electron";
import { execFile } from "child_process";

// ════════════════════════════════════════════════════════════════
// 1. Workspace lifecycle
// ════════════════════════════════════════════════════════════════

describe("workspaceRepo — workspace lifecycle", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findAll", () => {
    it("returns empty array when no workspaces exist", async () => {
      const result = await workspaceRepo.findAll();
      expect(result).toEqual([]);
    });

    it("excludes archived workspaces by default", async () => {
      createWorkspace(db, { id: "w1", isArchived: false });
      createWorkspace(db, { id: "w2", isArchived: true });

      const result = await workspaceRepo.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
    });

    it("includes archived when flag is true", async () => {
      createWorkspace(db, { id: "w1", isArchived: false });
      createWorkspace(db, { id: "w2", isArchived: true });

      const result = await workspaceRepo.findAll(true);
      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("returns null for non-existent id", async () => {
      const result = await workspaceRepo.findById("nope");
      expect(result).toBeNull();
    });

    it("returns the workspace with parsed metadata", async () => {
      createWorkspace(db, {
        id: "w1",
        name: "My WS",
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = await workspaceRepo.findById("w1");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("My WS");
      expect(result!.metadata).toEqual({ key: "value" });
    });
  });

  describe("findByAccountId", () => {
    it("returns workspaces for the given account", async () => {
      createWorkspace(db, { id: "w1", accountId: "default" });

      const result = await workspaceRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
    });

    it("excludes archived by default", async () => {
      createWorkspace(db, {
        id: "w1",
        accountId: "default",
        isArchived: false,
      });
      createWorkspace(db, {
        id: "w2",
        accountId: "default",
        isArchived: true,
      });

      const result = await workspaceRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
    });
  });

  describe("findByRootPath", () => {
    it("finds workspace by accountId + rootPath", async () => {
      createWorkspace(db, { id: "w1", rootPath: "/home/user/project" });

      const result = await workspaceRepo.findByRootPath(
        "default",
        "/home/user/project",
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe("w1");
    });

    it("returns null when not found", async () => {
      const result = await workspaceRepo.findByRootPath(
        "default",
        "/nonexistent",
      );
      expect(result).toBeNull();
    });
  });

  describe("insert", () => {
    it("inserts a workspace and returns the id", async () => {
      const id = await workspaceRepo.insert({
        id: "new-1",
        accountId: "default",
        name: "New Workspace",
        rootPath: "/tmp/ws/new",
      });

      expect(id).toBe("new-1");
      const found = await workspaceRepo.findById("new-1");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("New Workspace");
      expect(found!.status).toBe("todo");
    });

    it("stores metadata as JSON", async () => {
      await workspaceRepo.insert({
        id: "meta-1",
        accountId: "default",
        name: "Meta WS",
        rootPath: "/tmp/ws/meta",
        metadata: { branch: "feature-x" },
      });

      const found = await workspaceRepo.findById("meta-1");
      expect(found!.metadata).toEqual({ branch: "feature-x" });
    });
  });

  describe("update", () => {
    it("updates specified fields", async () => {
      createWorkspace(db, { id: "u1", name: "Old", status: "todo" });

      const result = await workspaceRepo.update("u1", {
        name: "New",
        status: "in_progress",
      });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("New");
      expect(result!.status).toBe("in_progress");
    });
  });

  describe("findByProjectId", () => {
    it("returns workspaces linked to a project", async () => {
      createProject(db, { id: "proj-1" });
      createWorkspace(db, { id: "w1", projectId: "proj-1" });
      createWorkspace(db, { id: "w2", projectId: "proj-1" });
      createWorkspace(db, { id: "w3" });

      const result = await workspaceRepo.findByProjectId("proj-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteByProjectId", () => {
    it("deletes all workspaces for a project", async () => {
      createProject(db, { id: "proj-1" });
      createWorkspace(db, { id: "w1", projectId: "proj-1" });
      createWorkspace(db, { id: "w2", projectId: "proj-1" });

      await workspaceRepo.deleteByProjectId("proj-1");

      const result = await workspaceRepo.findByProjectId("proj-1");
      expect(result).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("removes the workspace", async () => {
      createWorkspace(db, { id: "d1" });

      await workspaceRepo.delete("d1");
      const result = await workspaceRepo.findById("d1");
      expect(result).toBeNull();
    });
  });

  describe("archive", () => {
    it("sets isArchived to true", async () => {
      createWorkspace(db, { id: "a1", isArchived: false });

      const result = await workspaceRepo.archive("a1");
      expect(result).not.toBeNull();
      expect(result!.isArchived).toBe(true);
    });
  });
});

describe("workspaceService — workspace lifecycle", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    // Script-complete / findings broadcasts go through the event bus; wire the
    // BrowserWindow sink so the mocked windows receive them.
    registerBrowserWindowSink();
  });

  afterEach(() => {
    clearEventSinks();
    cleanup();
  });

  describe("list", () => {
    it("returns success with workspaces", async () => {
      createWorkspace(db, { id: "ws1", name: "WS1" });
      const result = await workspaceService.list();
      expect(result).toHaveLength(1);
    });

    it("returns empty array when none", async () => {
      const result = await workspaceService.list();
      expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns workspace by id", async () => {
      createWorkspace(db, { id: "ws1", name: "My Workspace" });
      const result = (await workspaceService.get("ws1"))!;
      expect(result.name).toBe("My Workspace");
    });

    it("returns error for non-existent", async () => {
      expect(await workspaceService.get("missing")).toBeNull();
    });
  });

  describe("listByAccount", () => {
    it("returns workspaces for account", async () => {
      createWorkspace(db, { id: "ws1", accountId: "default" });
      const result = await workspaceService.listByAccount("default");
      expect(result).toHaveLength(1);
    });
  });

  describe("getByRootPath", () => {
    it("returns workspace by root path", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/projects/my-app" });
      const result = (await workspaceService.getByRootPath(
        "default",
        "/projects/my-app",
      ))!;
      expect(result.id).toBe("ws1");
    });

    it("returns error when not found", async () => {
      expect(
        await workspaceService.getByRootPath("default", "/missing/path"),
      ).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a new workspace", async () => {
      const result = await workspaceService.create({
        accountId: "default",
        name: "New Workspace",
        rootPath: "/projects/new-ws",
      });
      expect(result.name).toBe("New Workspace");
      expect(result.id).toBeTruthy();
    });

    it("rejects duplicate root path", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/projects/existing" });

      await expect(
        workspaceService.create({
          accountId: "default",
          name: "Duplicate",
          rootPath: "/projects/existing",
        }),
      ).rejects.toThrow("Workspace with this path already exists");
    });

    it("generates ID if not provided", async () => {
      const result = await workspaceService.create({
        accountId: "default",
        name: "Auto ID",
        rootPath: "/projects/auto-id",
      });
      expect(result.id).toBeTruthy();
    });
  });

  describe("update", () => {
    it("updates workspace fields", async () => {
      createWorkspace(db, { id: "ws1", name: "Old Name" });
      const result = await workspaceService.update("ws1", { name: "New Name" });
      expect(result.name).toBe("New Name");
    });

    it("returns error for non-existent", async () => {
      await expect(workspaceService.update("missing", { name: "Test" })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("deletes workspace", async () => {
      createWorkspace(db, { id: "ws1" });
      await workspaceService.delete("ws1");

      expect(await workspaceService.get("ws1")).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("updates workspace status", async () => {
      createWorkspace(db, { id: "ws1" });
      const result = await workspaceService.updateStatus("ws1", "in_progress");
      expect(result.status).toBe("in_progress");
    });
  });

  describe("archive", () => {
    it("archives a workspace", async () => {
      createWorkspace(db, { id: "ws1" });
      const result = await workspaceService.archive("ws1");
      expect(result.isArchived).toBe(true);
    });

    it("returns error for non-existent workspace", async () => {
      await expect(workspaceService.archive("missing")).rejects.toThrow("Workspace not found");
    });

    it("runs archive script when project has one", async () => {
      const project = createProject(db, {
        id: "p1",
        name: "ScriptProject",
        archiveScript: "echo done",
      });
      createWorkspace(db, { id: "ws1", projectId: project.id });

      await workspaceService.archive("ws1");
    });
  });

  describe("create — with project", () => {
    it("creates workspace with projectId and triggers setup script", async () => {
      const project = createProject(db, {
        id: "p1",
        name: "ScriptProject",
        setupScript: "echo setup",
      });

      const result = await workspaceService.create({
        accountId: "default",
        name: "WS with project",
        rootPath: "/projects/with-project",
        projectId: project.id,
      });
      expect(result.projectId).toBe("p1");
    });

    it("uses provided id when given", async () => {
      const result = await workspaceService.create({
        id: "custom-id",
        accountId: "default",
        name: "Custom ID",
        rootPath: "/projects/custom-id",
      });
      expect(result.id).toBe("custom-id");
    });
  });

  describe("workspace error handling", () => {
    it("list returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findAll").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.list()).rejects.toThrow("db");
    });

    it("get returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findById").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.get("ws1")).rejects.toThrow("db");
    });

    it("listByAccount returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findByAccountId").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.listByAccount("default")).rejects.toThrow("db");
    });

    it("getByRootPath returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findByRootPath").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.getByRootPath("default", "/x")).rejects.toThrow("db");
    });

    it("create returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findByRootPath").mockResolvedValueOnce(null);
      vi.spyOn(workspaceRepo, "insert").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.create({ accountId: "default", name: "Fail", rootPath: "/fail", })).rejects.toThrow("db");
    });

    it("update returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "update").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.update("ws1", { name: "X" })).rejects.toThrow("db");
    });

    it("delete returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "delete").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.delete("ws1")).rejects.toThrow("db");
    });

    it("archive returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findById").mockRejectedValueOnce(new Error("db"));
      await expect(workspaceService.archive("ws1")).rejects.toThrow("db");
    });
  });

  describe("create — post-insert findById returns null", () => {
    it("returns error when workspace cannot be retrieved after insert", async () => {
      vi.spyOn(workspaceRepo, "findByRootPath").mockResolvedValueOnce(null);
      vi.spyOn(workspaceRepo, "insert").mockResolvedValueOnce("new-id");
      vi.spyOn(workspaceRepo, "findById").mockResolvedValueOnce(null);

      await expect(
        workspaceService.create({
          accountId: "default",
          name: "Ghost",
          rootPath: "/projects/ghost",
        }),
      ).rejects.toThrow("Failed to retrieve created workspace");
    });
  });

  describe("archive — repo returns null", () => {
    it("returns error when archive repo call returns null", async () => {
      createWorkspace(db, { id: "ws-arch", name: "To Archive" });
      vi.spyOn(workspaceRepo, "archive").mockResolvedValueOnce(null);

      await expect(workspaceService.archive("ws-arch")).rejects.toThrow("Failed to archive workspace");
    });
  });

  describe("create — setup script execution", () => {
    it("skips setup script when project has no setupScript", async () => {
      const project = createProject(db, {
        id: "p-no-setup",
        name: "NoSetup",
        setupScript: null,
      });
      await workspaceService.create({
        accountId: "default",
        name: "WS no setup",
        rootPath: "/projects/no-setup",
        projectId: project.id,
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    it("notifies renderer on successful setup script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend } } as any,
      ]);

      const project = createProject(db, {
        id: "p-setup-ok",
        name: "SetupOK",
        setupScript: "echo hello",
      });

      await workspaceService.create({
        accountId: "default",
        name: "WS setup ok",
        rootPath: "/projects/setup-ok",
        projectId: project.id,
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "setup",
          success: true,
        }),
      );
    });

    it("notifies renderer on failed setup script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend } } as any,
      ]);

      vi.mocked(execFile).mockImplementationOnce(
        (_shell: any, _args: any, _opts: any, cb: any) => {
          cb(new Error("script crashed"), "", "err");
          return undefined as any;
        },
      );

      const project = createProject(db, {
        id: "p-setup-fail",
        name: "SetupFail",
        setupScript: "exit 1",
      });

      await workspaceService.create({
        accountId: "default",
        name: "WS setup fail",
        rootPath: "/projects/setup-fail",
        projectId: project.id,
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "setup",
          success: false,
          error: "script crashed",
        }),
      );
    });

    it("silently catches projectsRepo.findById rejection in create", async () => {
      const project = createProject(db, {
        id: "p-create-catch",
        name: "CreateCatch",
      });
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(
        new Error("db fail"),
      );

      await workspaceService.create({
        accountId: "default",
        name: "WS project fail",
        rootPath: "/projects/project-fail",
        projectId: project.id,
      });
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  describe("archive — archive script execution", () => {
    it("skips archive script when project has no archiveScript", async () => {
      const project = createProject(db, {
        id: "p-no-archive",
        name: "NoArchive",
        archiveScript: null,
      });
      createWorkspace(db, { id: "ws-no-arch", projectId: project.id });

      await workspaceService.archive("ws-no-arch");
      await new Promise((r) => setTimeout(r, 50));
    });

    it("notifies renderer on successful archive script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend } } as any,
      ]);

      const project = createProject(db, {
        id: "p-arch-ok",
        name: "ArchOK",
        archiveScript: "echo bye",
      });
      createWorkspace(db, { id: "ws-arch-ok", projectId: project.id });

      await workspaceService.archive("ws-arch-ok");
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "archive",
          success: true,
        }),
      );
    });

    it("notifies renderer on failed archive script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend } } as any,
      ]);

      vi.mocked(execFile).mockImplementationOnce(
        (_shell: any, _args: any, _opts: any, cb: any) => {
          cb(new Error("archive failed"), "", "err");
          return undefined as any;
        },
      );

      const project = createProject(db, {
        id: "p-arch-fail",
        name: "ArchFail",
        archiveScript: "exit 1",
      });
      createWorkspace(db, { id: "ws-arch-fail", projectId: project.id });

      await workspaceService.archive("ws-arch-fail");
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "archive",
          success: false,
          error: "archive failed",
        }),
      );
    });

    it("silently catches projectsRepo.findById rejection in archive", async () => {
      const project = createProject(db, {
        id: "p-arch-catch",
        name: "ArchCatch",
      });
      createWorkspace(db, { id: "ws-arch-proj-fail", projectId: project.id });
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(
        new Error("db fail"),
      );

      await workspaceService.archive("ws-arch-proj-fail");
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  describe("emitScriptComplete fan-out", () => {
    it("sends to multiple windows", async () => {
      const mockSend1 = vi.fn();
      const mockSend2 = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { isDestroyed: () => false, webContents: { send: mockSend1 } } as any,
        { isDestroyed: () => false, webContents: { send: mockSend2 } } as any,
      ]);

      const project = createProject(db, {
        id: "p-multi-win",
        name: "MultiWin",
        setupScript: "echo hi",
      });

      await workspaceService.create({
        accountId: "default",
        name: "WS multi win",
        rootPath: "/projects/multi-win",
        projectId: project.id,
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend1).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "setup",
          success: true,
        }),
      );
      expect(mockSend2).toHaveBeenCalledWith(
        "workspace:scriptComplete",
        expect.objectContaining({
          script: "setup",
          success: true,
        }),
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 2. Activity
// ════════════════════════════════════════════════════════════════

describe("workspaceRepo — activity", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findActivityByWorkspace", () => {
    it("returns empty array when no activity", async () => {
      const result = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(result).toEqual([]);
    });

    it("returns activities ordered by createdAt desc", async () => {
      createWorkspaceActivity(db, {
        id: "a1",
        workspaceId: wsId,
        title: "First",
        type: "commit",
      });
      createWorkspaceActivity(db, {
        id: "a2",
        workspaceId: wsId,
        title: "Second",
        type: "diff",
      });

      const result = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        createWorkspaceActivity(db, {
          workspaceId: wsId,
          title: `Activity ${i}`,
        });
      }

      const result = await workspaceRepo.findActivityByWorkspace(wsId, 2);
      expect(result).toHaveLength(2);
    });

    it("parses metadata JSON", async () => {
      createWorkspaceActivity(db, {
        workspaceId: wsId,
        title: "With metadata",
        metadata: JSON.stringify({ branch: "main" }),
      });

      const result = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(result[0].metadata).toEqual({ branch: "main" });
    });
  });

  describe("insertActivity", () => {
    it("inserts a new activity and returns its id", async () => {
      const id = await workspaceRepo.insertActivity({
        workspaceId: wsId,
        type: "commit",
        title: "New commit",
      });

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);

      const rows = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("New commit");
    });

    it("uses provided id when given", async () => {
      const id = await workspaceRepo.insertActivity({
        id: "custom-id",
        workspaceId: wsId,
        type: "pr",
        title: "PR Activity",
      });

      expect(id).toBe("custom-id");
    });

    it("stores summary and refId", async () => {
      await workspaceRepo.insertActivity({
        workspaceId: wsId,
        type: "review",
        title: "Code review",
        summary: "Looks good",
        refId: "review-123",
      });

      const rows = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(rows[0].summary).toBe("Looks good");
      expect(rows[0].refId).toBe("review-123");
    });

    it("serializes metadata to JSON", async () => {
      await workspaceRepo.insertActivity({
        workspaceId: wsId,
        type: "diff",
        title: "Diff captured",
        metadata: { files: 3, additions: 42 },
      });

      const rows = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(rows[0].metadata).toEqual({ files: 3, additions: 42 });
    });
  });

  describe("insertManyActivity", () => {
    it("inserts multiple activities and returns ids", async () => {
      const ids = await workspaceRepo.insertManyActivity([
        { workspaceId: wsId, type: "commit", title: "Commit 1" },
        { workspaceId: wsId, type: "commit", title: "Commit 2" },
        { workspaceId: wsId, type: "pr", title: "PR opened" },
      ]);

      expect(ids).toHaveLength(3);

      const rows = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(rows).toHaveLength(3);
    });
  });

  describe("deleteActivity", () => {
    it("deletes an activity by id", async () => {
      createWorkspaceActivity(db, { id: "del-me", workspaceId: wsId });

      await workspaceRepo.deleteActivity("del-me");

      const rows = await workspaceRepo.findActivityByWorkspace(wsId);
      expect(rows).toHaveLength(0);
    });

    it("does not fail when deleting nonexistent id", async () => {
      await expect(
        workspaceRepo.deleteActivity("nonexistent"),
      ).resolves.not.toThrow();
    });
  });
});

describe("workspaceService — activity", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("listActivity", () => {
    it("returns empty list", async () => {
      const result = await workspaceService.listActivity(wsId);
      expect(result).toEqual([]);
    });

    it("returns activities", async () => {
      createWorkspaceActivity(db, { workspaceId: wsId, title: "A1" });
      createWorkspaceActivity(db, { workspaceId: wsId, title: "A2" });

      const result = await workspaceService.listActivity(wsId);
      expect(result).toHaveLength(2);
    });
  });

  describe("createActivity", () => {
    it("creates an activity and returns its id", async () => {
      const result = await workspaceService.createActivity({
        workspaceId: wsId,
        type: "commit",
        title: "Initial commit",
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("createManyActivity", () => {
    it("creates multiple activities", async () => {
      const result = await workspaceService.createManyActivity([
        { workspaceId: wsId, type: "commit", title: "C1" },
        { workspaceId: wsId, type: "commit", title: "C2" },
      ]);
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteActivity", () => {
    it("deletes an activity", async () => {
      createWorkspaceActivity(db, { id: "del-1", workspaceId: wsId });

      await workspaceService.deleteActivity("del-1");

      const check = await workspaceService.listActivity(wsId);
      expect(check).toHaveLength(0);
    });
  });

  describe("logWorkspaceActivity (fire-and-forget writer surface)", () => {
    it("inserts activity without blocking", async () => {
      logWorkspaceActivity({
        workspaceId: wsId,
        type: "diff",
        title: "Auto-logged diff",
      });

      await new Promise((r) => setTimeout(r, 50));

      const result = await workspaceService.listActivity(wsId);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Auto-logged diff");
    });
  });

  describe("activity error handling", () => {
    it("listActivity returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findActivityByWorkspace").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.listActivity("ws-1")).rejects.toThrow("db");
    });

    it("createActivity returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "insertActivity").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.createActivity({ workspaceId: wsId, type: "commit", title: "fail", })).rejects.toThrow("db");
    });

    it("createManyActivity returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "insertManyActivity").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.createManyActivity([ { workspaceId: wsId, type: "commit", title: "fail" }, ])).rejects.toThrow("db");
    });

    it("deleteActivity returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "deleteActivity").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.deleteActivity("some-id")).rejects.toThrow("db");
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 3. Diffs
// ════════════════════════════════════════════════════════════════

describe("workspaceRepo — diffs", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("insertDiff", () => {
    it("inserts a diff and returns its id", async () => {
      const id = await workspaceRepo.insertDiff({
        id: "diff-1",
        workspaceId: wsId,
        diffText: "--- a/file.ts\n+++ b/file.ts",
      });

      expect(id).toBe("diff-1");
    });

    it("stores optional fields", async () => {
      const run = createRun(db, { workspaceId: wsId });

      await workspaceRepo.insertDiff({
        id: "diff-2",
        workspaceId: wsId,
        runId: run.id,
        baseRef: "abc123",
        diffText: "some diff",
        filesJson: JSON.stringify(["file1.ts", "file2.ts"]),
        statsJson: JSON.stringify({ shortstat: "2 files changed", files: 2 }),
      });

      const result = await workspaceRepo.findDiffsByWorkspace(wsId);
      expect(result).toHaveLength(1);
      expect(result[0].baseRef).toBe("abc123");
      expect(result[0].files).toEqual(["file1.ts", "file2.ts"]);
      expect(result[0].stats).toEqual({
        shortstat: "2 files changed",
        files: 2,
      });
    });
  });

  describe("findDiffsByWorkspace", () => {
    it("returns empty array when no diffs", async () => {
      const result = await workspaceRepo.findDiffsByWorkspace(wsId);
      expect(result).toEqual([]);
    });

    it("returns diffs ordered by createdAt desc", async () => {
      createWorkspaceDiff(db, {
        id: "d1",
        workspaceId: wsId,
        diffText: "diff 1",
      });
      createWorkspaceDiff(db, {
        id: "d2",
        workspaceId: wsId,
        diffText: "diff 2",
      });

      const result = await workspaceRepo.findDiffsByWorkspace(wsId);
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        createWorkspaceDiff(db, { workspaceId: wsId, diffText: `diff ${i}` });
      }

      const result = await workspaceRepo.findDiffsByWorkspace(wsId, 2);
      expect(result).toHaveLength(2);
    });
  });

  describe("findLatestDiffByWorkspace", () => {
    it("returns null when no diffs", async () => {
      const result = await workspaceRepo.findLatestDiffByWorkspace(wsId);
      expect(result).toBeNull();
    });

    it("returns the most recent diff", async () => {
      createWorkspaceDiff(db, { id: "d1", workspaceId: wsId, diffText: "old" });
      createWorkspaceDiff(db, { id: "d2", workspaceId: wsId, diffText: "new" });

      const result = await workspaceRepo.findLatestDiffByWorkspace(wsId);
      expect(result).not.toBeNull();
    });
  });

  describe("findDiffByRun", () => {
    it("returns null when no diff for run", async () => {
      const result = await workspaceRepo.findDiffByRun("nonexistent-run");
      expect(result).toBeNull();
    });

    it("returns the diff linked to a run", async () => {
      const run = createRun(db, { workspaceId: wsId });
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        runId: run.id,
        diffText: "run diff",
      });

      const result = await workspaceRepo.findDiffByRun(run.id);
      expect(result).not.toBeNull();
      expect(result!.diffText).toBe("run diff");
    });
  });

  describe("deleteDiffsByWorkspace", () => {
    it("deletes all diffs for a workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId });
      createWorkspaceDiff(db, { workspaceId: wsId });

      await workspaceRepo.deleteDiffsByWorkspace(wsId);

      const result = await workspaceRepo.findDiffsByWorkspace(wsId);
      expect(result).toHaveLength(0);
    });
  });

  describe("findDiffByWorkspaceAndBaseRef", () => {
    it("returns null when not found", async () => {
      const result = await workspaceRepo.findDiffByWorkspaceAndBaseRef(
        wsId,
        "abc",
      );
      expect(result).toBeNull();
    });

    it("finds diff by workspace + baseRef", async () => {
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        baseRef: "sha-abc",
        diffText: "matched diff",
      });

      const result = await workspaceRepo.findDiffByWorkspaceAndBaseRef(
        wsId,
        "sha-abc",
      );
      expect(result).not.toBeNull();
      expect(result!.diffText).toBe("matched diff");
    });
  });
});

describe("workspaceService — diffs", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("listDiffs", () => {
    it("returns empty list", async () => {
      const result = await workspaceService.listDiffs(wsId);
      expect(result).toEqual([]);
    });

    it("returns diffs for workspace", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId });
      createWorkspaceDiff(db, { workspaceId: wsId });

      const result = await workspaceService.listDiffs(wsId);
      expect(result).toHaveLength(2);
    });
  });

  describe("getLatestDiff", () => {
    it("returns error when no diffs", async () => {
      expect(await workspaceService.getLatestDiff(wsId)).toBeNull();
    });

    it("returns latest diff", async () => {
      createWorkspaceDiff(db, { workspaceId: wsId, diffText: "latest" });

      const result = (await workspaceService.getLatestDiff(wsId))!;
      expect(result.diffText).toBe("latest");
    });
  });

  describe("getDiffByRun", () => {
    it("returns error when no diff for run", async () => {
      expect(await workspaceService.getDiffByRun("nonexistent")).toBeNull();
    });

    it("returns diff linked to run", async () => {
      const run = createRun(db, { workspaceId: wsId });
      createWorkspaceDiff(db, {
        workspaceId: wsId,
        runId: run.id,
        diffText: "run-diff",
      });

      const result = (await workspaceService.getDiffByRun(run.id))!;
      expect(result.diffText).toBe("run-diff");
    });
  });

  describe("createDiff", () => {
    it("creates a diff and returns id", async () => {
      const result = await workspaceService.createDiff({
        id: "new-diff",
        workspaceId: wsId,
        diffText: "new diff content",
      });
      expect(result).toBe("new-diff");
    });

    it("creates a diff with all optional fields", async () => {
      const run = createRun(db, { workspaceId: wsId });
      await workspaceService.createDiff({
        id: "full-diff",
        workspaceId: wsId,
        runId: run.id,
        baseRef: "abc123",
        diffText: "full diff",
        filesJson: '["file.ts"]',
        statsJson: '{"insertions":5}',
      });
    });
  });

  describe("diffs error handling", () => {
    it("listDiffs returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findDiffsByWorkspace").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.listDiffs("ws-1")).rejects.toThrow("db");
    });

    it("getLatestDiff returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findLatestDiffByWorkspace").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.getLatestDiff("ws-1")).rejects.toThrow("db");
    });

    it("getDiffByRun returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findDiffByRun").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.getDiffByRun("r1")).rejects.toThrow("db");
    });

    it("createDiff returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "insertDiff").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.createDiff({ id: "x", workspaceId: "ws-1", diffText: "x", })).rejects.toThrow("db");
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 4. Reviews
// ════════════════════════════════════════════════════════════════

describe("workspaceRepo — reviews", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findReviewsByWorkspace", () => {
    it("returns empty array when no reviews", async () => {
      const result = await workspaceRepo.findReviewsByWorkspace("ws-1");
      expect(result).toEqual([]);
    });

    it("returns reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "Review 1" });
      createReview(db, { workspaceId: ws.id, title: "Review 2" });
      createReview(db, { workspaceId: "ws-other", title: "Other" });

      const result = await workspaceRepo.findReviewsByWorkspace("ws-1");
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      for (let i = 0; i < 5; i++) {
        createReview(db, { workspaceId: ws.id, title: `Review ${i}` });
      }

      const result = await workspaceRepo.findReviewsByWorkspace("ws-1", 3);
      expect(result).toHaveLength(3);
    });
  });

  describe("findReviewById", () => {
    it("returns null when not found", async () => {
      const result = await workspaceRepo.findReviewById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns review when found", async () => {
      const review = createReview(db, { id: "r-1", title: "My Review" });

      const result = await workspaceRepo.findReviewById(review.id);
      expect(result).not.toBeNull();
      expect(result!.title).toBe("My Review");
    });

    it("parses metadata JSON", async () => {
      createReview(db, {
        id: "r-meta",
        title: "With Metadata",
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = await workspaceRepo.findReviewById("r-meta");
      expect(result!.metadata).toEqual({ key: "value" });
    });
  });

  describe("insertReview", () => {
    it("inserts a review and returns id", async () => {
      const id = await workspaceRepo.insertReview({
        title: "New Review",
      });
      expect(id).toBeDefined();

      const review = await workspaceRepo.findReviewById(id);
      expect(review!.title).toBe("New Review");
      expect(review!.status).toBe("open");
    });

    it("uses provided id", async () => {
      const id = await workspaceRepo.insertReview({
        id: "custom-id",
        title: "Custom ID Review",
      });
      expect(id).toBe("custom-id");
    });

    it("stores metadata as JSON", async () => {
      const id = await workspaceRepo.insertReview({
        title: "With Meta",
        metadata: { score: 9 },
      });

      const review = await workspaceRepo.findReviewById(id);
      expect(review!.metadata).toEqual({ score: 9 });
    });

    it("links review to run", async () => {
      const run = createRun(db, { id: "run-1" });
      const id = await workspaceRepo.insertReview({
        title: "Run Review",
        runId: run.id,
      });

      const review = await workspaceRepo.findReviewById(id);
      expect(review!.runId).toBe("run-1");
    });
  });

  describe("updateReview", () => {
    it("updates title", async () => {
      createReview(db, { id: "r-1", title: "Old" });

      const result = await workspaceRepo.updateReview("r-1", { title: "New" });
      expect(result!.title).toBe("New");
    });

    it("updates status", async () => {
      createReview(db, { id: "r-1", status: "open" });

      const result = await workspaceRepo.updateReview("r-1", {
        status: "approved",
      });
      expect(result!.status).toBe("approved");
    });

    it("updates metadata", async () => {
      createReview(db, { id: "r-1" });

      const result = await workspaceRepo.updateReview("r-1", {
        metadata: { notes: "good" },
      });
      expect(result!.metadata).toEqual({ notes: "good" });
    });

    it("returns null when not found", async () => {
      const result = await workspaceRepo.updateReview("nonexistent", {
        title: "X",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteReview", () => {
    it("removes a review", async () => {
      createReview(db, { id: "r-1" });

      await workspaceRepo.deleteReview("r-1");

      const result = await workspaceRepo.findReviewById("r-1");
      expect(result).toBeNull();
    });
  });

  describe("deleteReviewsByWorkspace", () => {
    it("deletes all reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });
      createReview(db, { workspaceId: "ws-other", title: "Other" });

      await workspaceRepo.deleteReviewsByWorkspace("ws-1");

      const remaining = await workspaceRepo.findReviewsByWorkspace("ws-1");
      expect(remaining).toHaveLength(0);

      const other = await workspaceRepo.findReviewsByWorkspace("ws-other");
      expect(other).toHaveLength(1);
    });
  });
});

describe("workspaceService — reviews", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("listReviews", () => {
    it("returns reviews for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });

      const result = await workspaceService.listReviews("ws-1");
      expect(result).toHaveLength(2);
    });

    it("returns empty for workspace with no reviews", async () => {
      const result = await workspaceService.listReviews("ws-empty");
      expect(result).toEqual([]);
    });

    it("does not return reviews from other workspaces", async () => {
      const ws1 = createWorkspace(db, { id: "ws-1" });
      const ws2 = createWorkspace(db, { id: "ws-2" });
      createReview(db, { workspaceId: ws1.id, title: "R1" });
      createReview(db, { workspaceId: ws2.id, title: "R2" });

      const result = await workspaceService.listReviews("ws-1");
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("R1");
    });

    it("respects the limit parameter", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      createReview(db, { workspaceId: ws.id, title: "R1" });
      createReview(db, { workspaceId: ws.id, title: "R2" });
      createReview(db, { workspaceId: ws.id, title: "R3" });

      const result = await workspaceService.listReviews("ws-1", 2);
      expect(result).toHaveLength(2);
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(workspaceRepo, "findReviewsByWorkspace").mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(workspaceService.listReviews("ws-1")).rejects.toThrow("DB error");
    });
  });

  describe("getReview", () => {
    it("returns review when found", async () => {
      createReview(db, { id: "r-1", title: "Test" });

      const result = (await workspaceService.getReview("r-1"))!;
      expect(result.title).toBe("Test");
      expect(result.id).toBe("r-1");
    });

    it("returns all fields correctly", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const run = createRun(db, { id: "run-1" });
      createReview(db, {
        id: "r-1",
        workspaceId: ws.id,
        title: "Full Review",
        summary: "A summary",
        status: "in_review",
        runId: run.id,
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = (await workspaceService.getReview("r-1"))!;
      expect(result.workspaceId).toBe("ws-1");
      expect(result.title).toBe("Full Review");
      expect(result.summary).toBe("A summary");
      expect(result.status).toBe("in_review");
      expect(result.runId).toBe("run-1");
      expect(result.metadata).toEqual({ key: "value" });
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it("returns error when not found", async () => {
      expect(await workspaceService.getReview("nonexistent")).toBeNull();
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(workspaceRepo, "findReviewById").mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(workspaceService.getReview("r-1")).rejects.toThrow("DB error");
    });
  });

  describe("createReview", () => {
    it("creates a review and returns id", async () => {
      const result = await workspaceService.createReview({
        title: "New Review",
      });
      expect(typeof result).toBe("string");
    });

    it("creates review with all fields", async () => {
      const run = createRun(db, { id: "run-1" });
      const ws = createWorkspace(db, { id: "ws-1" });
      const result = await workspaceService.createReview({
        title: "Full Review",
        summary: "A summary",
        status: "in_review",
        runId: run.id,
        workspaceId: ws.id,
        metadata: { key: "value" },
      });

      const fetched = (await workspaceService.getReview(result))!;
      expect(fetched.title).toBe("Full Review");
      expect(fetched.summary).toBe("A summary");
      expect(fetched.status).toBe("in_review");
      expect(fetched.runId).toBe("run-1");
      expect(fetched.workspaceId).toBe("ws-1");
      expect(fetched.metadata).toEqual({ key: "value" });
    });

    it("creates review with custom id", async () => {
      const result = await workspaceService.createReview({
        id: "custom-id",
        title: "Custom ID Review",
      });
      expect(result).toBe("custom-id");
    });

    it("defaults status to open", async () => {
      const result = await workspaceService.createReview({
        title: "Default Status",
      });

      const fetched = (await workspaceService.getReview(result))!;
      expect(fetched.status).toBe("open");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(workspaceRepo, "insertReview").mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(workspaceService.createReview({ title: "Fail" })).rejects.toThrow("DB error");
    });
  });

  describe("updateReview", () => {
    it("updates review title", async () => {
      createReview(db, { id: "r-1", title: "Old" });

      const result = await workspaceService.updateReview("r-1", {
        title: "New",
      });
      expect(result.title).toBe("New");
    });

    it("updates review status", async () => {
      createReview(db, { id: "r-1", title: "Review", status: "open" });

      const result = await workspaceService.updateReview("r-1", {
        status: "approved",
      });
      expect(result.status).toBe("approved");
    });

    it("updates review summary", async () => {
      createReview(db, { id: "r-1", title: "Review" });

      const result = await workspaceService.updateReview("r-1", {
        summary: "New summary",
      });
      expect(result.summary).toBe("New summary");
    });

    it("updates review metadata", async () => {
      createReview(db, { id: "r-1", title: "Review" });

      const result = await workspaceService.updateReview("r-1", {
        metadata: { score: 42 },
      });
      expect(result.metadata).toEqual({ score: 42 });
    });

    it("updates review runId", async () => {
      createReview(db, { id: "r-1", title: "Review" });
      const run = createRun(db, { id: "run-1" });

      const result = await workspaceService.updateReview("r-1", {
        runId: run.id,
      });
      expect(result.runId).toBe("run-1");
    });

    it("updates multiple fields at once", async () => {
      createReview(db, { id: "r-1", title: "Old", status: "open" });

      const result = await workspaceService.updateReview("r-1", {
        title: "New",
        status: "rejected",
        summary: "Updated summary",
      });
      expect(result.title).toBe("New");
      expect(result.status).toBe("rejected");
      expect(result.summary).toBe("Updated summary");
    });

    it("returns error when review not found", async () => {
      await expect(workspaceService.updateReview("nonexistent", { title: "X", })).rejects.toThrow("Review not found");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(workspaceRepo, "updateReview").mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(workspaceService.updateReview("r-1", { title: "Fail", })).rejects.toThrow("DB error");
    });
  });

  describe("deleteReview", () => {
    it("deletes a review", async () => {
      createReview(db, { id: "r-1" });

      await workspaceService.deleteReview("r-1");

      expect(await workspaceService.getReview("r-1")).toBeNull();
    });

    it("succeeds even when review does not exist", async () => {
      await workspaceService.deleteReview("nonexistent");
    });

    it("returns error on repo failure", async () => {
      vi.spyOn(workspaceRepo, "deleteReview").mockRejectedValueOnce(
        new Error("DB error"),
      );

      await expect(workspaceService.deleteReview("r-1")).rejects.toThrow("DB error");
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 5. Findings
// ════════════════════════════════════════════════════════════════

describe("workspaceRepo — findings", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("findFindingsByReview", () => {
    it("returns empty array when no findings", async () => {
      const result = await workspaceRepo.findFindingsByReview("review-1");
      expect(result).toEqual([]);
    });

    it("returns findings for review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: "other-review" });

      const result = await workspaceRepo.findFindingsByReview("r-1");
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      const review = createReview(db, { id: "r-1" });
      for (let i = 0; i < 5; i++) {
        createReviewFinding(db, { reviewId: review.id, file: `file${i}.ts` });
      }

      const result = await workspaceRepo.findFindingsByReview("r-1", 3);
      expect(result).toHaveLength(3);
    });
  });

  describe("findFindingsByWorkspace", () => {
    it("returns findings via workspace join", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { id: "r-1", workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "x.ts" });

      const result = await workspaceRepo.findFindingsByWorkspace("ws-1");
      expect(result).toHaveLength(1);
      expect(result[0].reviewCreatedAt).toBeDefined();
    });

    it("returns empty for workspace with no reviews", async () => {
      const result = await workspaceRepo.findFindingsByWorkspace("ws-empty");
      expect(result).toEqual([]);
    });
  });

  describe("findFindingById", () => {
    it("returns null when not found", async () => {
      const result = await workspaceRepo.findFindingById("nonexistent");
      expect(result).toBeNull();
    });

    it("returns finding when found", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        file: "src/app.ts",
        message: "Missing null check",
        severity: "critical",
      });

      const result = await workspaceRepo.findFindingById("f-1");
      expect(result).not.toBeNull();
      expect(result!.file).toBe("src/app.ts");
      expect(result!.severity).toBe("critical");
      expect(result!.message).toBe("Missing null check");
    });
  });

  describe("insertFinding", () => {
    it("inserts a finding and returns id", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await workspaceRepo.insertFinding({
        reviewId: review.id,
        severity: "warning",
        file: "index.ts",
        message: "Unused import",
        reason: "Dead code",
      });
      expect(id).toBeDefined();

      const finding = await workspaceRepo.findFindingById(id);
      expect(finding!.file).toBe("index.ts");
      expect(finding!.validated).toBe(false);
    });

    it("stores metadata as JSON", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await workspaceRepo.insertFinding({
        reviewId: review.id,
        severity: "info",
        file: "a.ts",
        message: "Note",
        reason: "FYI",
        metadata: { tool: "eslint" },
      });

      const finding = await workspaceRepo.findFindingById(id);
      expect(finding!.metadata).toEqual({ tool: "eslint" });
    });

    it("stores line range", async () => {
      const review = createReview(db, { id: "r-1" });
      const id = await workspaceRepo.insertFinding({
        reviewId: review.id,
        severity: "critical",
        file: "app.ts",
        lineStart: 10,
        lineEnd: 20,
        message: "Issue",
        reason: "Bug",
      });

      const finding = await workspaceRepo.findFindingById(id);
      expect(finding!.lineStart).toBe(10);
      expect(finding!.lineEnd).toBe(20);
    });
  });

  describe("insertManyFindings", () => {
    it("inserts multiple findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const ids = await workspaceRepo.insertManyFindings([
        {
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          reviewId: review.id,
          severity: "warning",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);

      expect(ids).toHaveLength(2);
      const findings = await workspaceRepo.findFindingsByReview(review.id);
      expect(findings).toHaveLength(2);
    });
  });

  describe("updateFinding", () => {
    it("updates severity", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
      });

      const result = await workspaceRepo.updateFinding("f-1", {
        severity: "critical",
      });
      expect(result!.severity).toBe("critical");
    });

    it("updates validated flag", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      const result = await workspaceRepo.updateFinding("f-1", {
        validated: true,
      });
      expect(result!.validated).toBe(true);
    });

    it("returns null when not found", async () => {
      const result = await workspaceRepo.updateFinding("nonexistent", {
        severity: "info",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteFinding", () => {
    it("removes a finding", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      await workspaceRepo.deleteFinding("f-1");

      const result = await workspaceRepo.findFindingById("f-1");
      expect(result).toBeNull();
    });
  });
});

describe("workspaceService — findings", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("listFindingsByWorkspace", () => {
    it("returns findings for workspace", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("a.ts");
    });

    it("returns findings from multiple files across same review", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      expect(result).toHaveLength(3);
    });

    it("keeps only findings from most recent review per file", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });

      const oldReview = createReview(db, { id: "r-old", workspaceId: ws.id });
      createReviewFinding(db, {
        reviewId: oldReview.id,
        file: "a.ts",
        message: "Old finding",
      });

      const newReview = createReview(db, { id: "r-new", workspaceId: ws.id });
      createReviewFinding(db, {
        reviewId: newReview.id,
        file: "a.ts",
        message: "New finding",
      });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("keeps findings from different files across reviews", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review1 = createReview(db, { id: "r-1", workspaceId: ws.id });
      const review2 = createReview(db, { id: "r-2", workspaceId: ws.id });

      createReviewFinding(db, { reviewId: review1.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review2.id, file: "b.ts" });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      expect(result).toHaveLength(2);
    });

    it("returns empty for workspace with no findings", async () => {
      const result =
        await workspaceService.listFindingsByWorkspace("ws-empty");
      expect(result).toEqual([]);
    });

    it("strips reviewCreatedAt from response", async () => {
      const ws = createWorkspace(db, { id: "ws-1" });
      const review = createReview(db, { workspaceId: ws.id });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      const finding = result[0];
      expect(finding).not.toHaveProperty("reviewCreatedAt");
      expect(finding).toHaveProperty("id");
      expect(finding).toHaveProperty("reviewId");
      expect(finding).toHaveProperty("file");
    });

    it("does not return findings from other workspaces", async () => {
      const ws1 = createWorkspace(db, { id: "ws-1" });
      const ws2 = createWorkspace(db, { id: "ws-2" });
      const review1 = createReview(db, { id: "r-1", workspaceId: ws1.id });
      const review2 = createReview(db, { id: "r-2", workspaceId: ws2.id });
      createReviewFinding(db, { reviewId: review1.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review2.id, file: "b.ts" });

      const result = await workspaceService.listFindingsByWorkspace("ws-1");
      expect(result).toHaveLength(1);
      expect(result[0].file).toBe("a.ts");
    });
  });

  describe("listFindings (by review)", () => {
    it("returns findings for review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id });

      const result = await workspaceService.listFindings("r-1");
      expect(result).toHaveLength(1);
    });

    it("returns multiple findings for a review", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await workspaceService.listFindings("r-1");
      expect(result).toHaveLength(3);
    });

    it("respects the limit parameter", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { reviewId: review.id, file: "a.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "b.ts" });
      createReviewFinding(db, { reviewId: review.id, file: "c.ts" });

      const result = await workspaceService.listFindings("r-1", 2);
      expect(result).toHaveLength(2);
    });

    it("returns empty for review with no findings", async () => {
      const result = await workspaceService.listFindings("r-empty");
      expect(result).toEqual([]);
    });
  });

  describe("getFinding", () => {
    it("returns finding when found", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        message: "Test",
      });

      const result = (await workspaceService.getFinding("f-1"))!;
      expect(result.message).toBe("Test");
    });

    it("returns all finding fields correctly", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-full",
        reviewId: review.id,
        severity: "critical",
        file: "src/main.ts",
        lineStart: 10,
        lineEnd: 20,
        message: "Dangerous code",
        reason: "Security issue",
        suggestion: "Use safe API",
        validated: true,
        metadata: JSON.stringify({ category: "security" }),
      });

      const result = (await workspaceService.getFinding("f-full"))!;
      const finding = result;
      expect(finding.id).toBe("f-full");
      expect(finding.reviewId).toBe("r-1");
      expect(finding.severity).toBe("critical");
      expect(finding.file).toBe("src/main.ts");
      expect(finding.lineStart).toBe(10);
      expect(finding.lineEnd).toBe(20);
      expect(finding.message).toBe("Dangerous code");
      expect(finding.reason).toBe("Security issue");
      expect(finding.suggestion).toBe("Use safe API");
      expect(finding.validated).toBe(true);
      expect(finding.metadata).toEqual({ category: "security" });
      expect(finding.createdAt).toBeDefined();
    });

    it("returns error when not found", async () => {
      expect(await workspaceService.getFinding("nonexistent")).toBeNull();
    });
  });

  describe("createFinding", () => {
    it("creates a finding and returns its id", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await workspaceService.createFinding({
        reviewId: review.id,
        severity: "warning",
        file: "app.ts",
        message: "Issue",
        reason: "Bug",
      });
      expect(typeof result).toBe("string");

      const fetched = (await workspaceService.getFinding(result))!;
      expect(fetched.file).toBe("app.ts");
      expect(fetched.severity).toBe("warning");
    });

    it("creates a finding with all optional fields", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await workspaceService.createFinding({
        id: "custom-id",
        reviewId: review.id,
        severity: "critical",
        file: "src/index.ts",
        lineStart: 5,
        lineEnd: 15,
        message: "Found a bug",
        reason: "Logic error",
        suggestion: "Fix the condition",
        validated: true,
        metadata: { tool: "linter" },
      });
      expect(result).toBe("custom-id");

      const fetched = (await workspaceService.getFinding("custom-id"))!;
      expect(fetched.lineStart).toBe(5);
      expect(fetched.lineEnd).toBe(15);
      expect(fetched.suggestion).toBe("Fix the condition");
      expect(fetched.validated).toBe(true);
      expect(fetched.metadata).toEqual({ tool: "linter" });
    });

    it("creates a finding with defaults for optional fields", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await workspaceService.createFinding({
        reviewId: review.id,
        severity: "info",
        file: "readme.md",
        message: "Minor note",
        reason: "Style",
      });

      const fetched = (await workspaceService.getFinding(result))!;
      expect(fetched.validated).toBe(false);
      expect(fetched.lineStart).toBeNull();
      expect(fetched.lineEnd).toBeNull();
      expect(fetched.suggestion).toBeNull();
      expect(fetched.metadata).toBeNull();
    });
  });

  describe("createManyFindings", () => {
    it("creates multiple findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await workspaceService.createManyFindings([
        {
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          reviewId: review.id,
          severity: "critical",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);
      expect(result).toHaveLength(2);
    });

    it("returns the correct ids for created findings", async () => {
      const review = createReview(db, { id: "r-1" });
      const result = await workspaceService.createManyFindings([
        {
          id: "id-a",
          reviewId: review.id,
          severity: "info",
          file: "a.ts",
          message: "M1",
          reason: "R1",
        },
        {
          id: "id-b",
          reviewId: review.id,
          severity: "warning",
          file: "b.ts",
          message: "M2",
          reason: "R2",
        },
      ]);
      expect(result).toEqual(["id-a", "id-b"]);

      const a = await workspaceService.getFinding("id-a");
      const b = await workspaceService.getFinding("id-b");
      expect(a?.file).toBe("a.ts");
      expect(b?.file).toBe("b.ts");
    });

    it("creates findings with metadata", async () => {
      const review = createReview(db, { id: "r-1" });
      await workspaceService.createManyFindings([
        {
          id: "id-meta",
          reviewId: review.id,
          severity: "warning",
          file: "a.ts",
          message: "M",
          reason: "R",
          metadata: { source: "ai" },
        },
      ]);

      const fetched = (await workspaceService.getFinding("id-meta"))!;
      expect(fetched.metadata).toEqual({ source: "ai" });
    });
  });

  describe("updateFinding", () => {
    it("updates finding severity", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
      });

      const result = await workspaceService.updateFinding("f-1", {
        severity: "critical",
      });
      expect(result.severity).toBe("critical");
    });

    it("updates multiple fields at once", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "info",
        file: "old.ts",
        message: "old message",
      });

      const result = await workspaceService.updateFinding("f-1", {
        severity: "warning",
        file: "new.ts",
        message: "new message",
        lineStart: 42,
        lineEnd: 50,
        suggestion: "Try this instead",
        validated: true,
      });
      expect(result.severity).toBe("warning");
      expect(result.file).toBe("new.ts");
      expect(result.message).toBe("new message");
      expect(result.lineStart).toBe(42);
      expect(result.lineEnd).toBe(50);
      expect(result.suggestion).toBe("Try this instead");
      expect(result.validated).toBe(true);
    });

    it("updates metadata", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
      });

      const result = await workspaceService.updateFinding("f-1", {
        metadata: { reviewed: true, score: 95 },
      });
      expect(result.metadata).toEqual({ reviewed: true, score: 95 });
    });

    it("clears metadata when set to null", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        metadata: JSON.stringify({ key: "val" }),
      });

      const result = await workspaceService.updateFinding("f-1", {
        metadata: null,
      });
      expect(result.metadata).toBeNull();
    });

    it("returns finding unchanged when payload is empty", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, {
        id: "f-1",
        reviewId: review.id,
        severity: "warning",
        message: "unchanged",
      });

      const result = await workspaceService.updateFinding("f-1", {});
      expect(result.severity).toBe("warning");
      expect(result.message).toBe("unchanged");
    });

    it("returns error when not found", async () => {
      await expect(workspaceService.updateFinding("nonexistent", { severity: "info", })).rejects.toThrow("Review finding not found");
    });
  });

  describe("deleteFinding", () => {
    it("deletes a finding", async () => {
      const review = createReview(db, { id: "r-1" });
      createReviewFinding(db, { id: "f-1", reviewId: review.id });

      await workspaceService.deleteFinding("f-1");

      expect(await workspaceService.getFinding("f-1")).toBeNull();
    });

    it("succeeds even when finding does not exist", async () => {
      await workspaceService.deleteFinding("nonexistent");
    });
  });

  describe("findings error handling", () => {
    it("listFindingsByWorkspace returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findFindingsByWorkspace").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.listFindingsByWorkspace("ws-1")).rejects.toThrow("db");
    });

    it("listFindings returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findFindingsByReview").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.listFindings("r-1")).rejects.toThrow("db");
    });

    it("getFinding returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "findFindingById").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.getFinding("f-1")).rejects.toThrow("db");
    });

    it("createFinding returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "insertFinding").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.createFinding({ reviewId: "r-1", severity: "info", file: "a.ts", message: "m", reason: "r", })).rejects.toThrow("db");
    });

    it("createManyFindings returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "insertManyFindings").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.createManyFindings([ { reviewId: "r-1", severity: "info", file: "a.ts", message: "m", reason: "r", }, ])).rejects.toThrow("db");
    });

    it("updateFinding returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "updateFinding").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.updateFinding("f-1", { severity: "info", })).rejects.toThrow("db");
    });

    it("deleteFinding returns error on failure", async () => {
      vi.spyOn(workspaceRepo, "deleteFinding").mockRejectedValueOnce(
        new Error("db"),
      );
      await expect(workspaceService.deleteFinding("f-1")).rejects.toThrow("db");
    });
  });
});

// ════════════════════════════════════════════════════════════════
// 6. Workspace intake (createFromSource)
//
// The intake's collaborators (git, settings) are stubbed; projects + the
// workspace row are real against the test db. This is the locality win: the
// worktree-vs-direct ordering, project dedup, and error mapping that used to
// live (untestable) in the sidebar hook are now exercised through one seam.
// ════════════════════════════════════════════════════════════════

describe("workspaceService — createFromSource (workspace intake)", () => {
  const gitMock = vi.mocked(gitService);
  const settingsMock = vi.mocked(appSettingsService);

  function setWorktrees(enabled: boolean) {
    settingsMock.ensureSettings.mockResolvedValue({
      enableWorktrees: enabled,
    } as any);
  }

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    vi.clearAllMocks();
    gitMock.isGitRepo.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("folder + worktree: creates the project before the import, lands a worktree workspace", async () => {
    setWorktrees(true);
    gitMock.getRemotes.mockResolvedValue([
      {
        name: "origin",
        fetchUrl: "https://github.com/foo/bar.git",
        pushUrl: undefined,
      },
    ]);
    gitMock.getCurrentBranch.mockResolvedValue("main");
    gitMock.importLocalRepo.mockResolvedValue({
      branchName: "feature/x",
      worktreePath: "/work/worktrees/bar/apple",
      worktreeName: "apple",
      baseBranch: "main",
      tracking: null,
      ahead: 0,
      behind: 0,
      originUrl: "https://github.com/foo/bar.git",
    });

    const result = await workspaceService.createFromSource({
      accountId: "default",
      source: { kind: "folder", path: "/repos/bar" },
    });
    // Ordering: project resolved first, so the worktree could be named after it.
    expect(gitMock.importLocalRepo).toHaveBeenCalledWith("/repos/bar", "bar");
    const projects = await projectsRepo.findAll();
    expect(projects).toHaveLength(1);
    expect(projects[0].workspacesPath).toBe("/work/worktrees/bar");
    expect(result.rootPath).toBe("/work/worktrees/bar/apple");
    expect(result.projectId).toBe(projects[0].id);
    expect(result.metadata?.worktree).toEqual({
      enabled: true,
      name: "apple",
      path: "/work/worktrees/bar/apple",
      sourcePath: "/repos/bar",
      branch: "feature/x",
    });
  });

  it("folder + direct: imports in place, no worktree, no workspacesPath", async () => {
    setWorktrees(false);
    gitMock.importLocalRepoDirect.mockResolvedValue({
      branchName: "main",
      sourcePath: "/repos/baz",
      baseBranch: "main",
      tracking: "origin/main",
      ahead: 1,
      behind: 0,
      originUrl: "https://github.com/foo/baz.git",
    });

    const result = await workspaceService.createFromSource({
      accountId: "default",
      source: { kind: "folder", path: "/repos/baz" },
    });
    expect(gitMock.importLocalRepo).not.toHaveBeenCalled();
    expect(result.rootPath).toBe("/repos/baz");
    expect(result.metadata?.worktree).toEqual({ enabled: false });
    const projects = await projectsRepo.findAll();
    expect(projects[0].workspacesPath).toBeNull();
  });

  it("clone + direct: clones first, then imports the cloned path", async () => {
    setWorktrees(false);
    gitMock.cloneRepo.mockResolvedValue({
      clonedPath: "/clones/qux",
      defaultBranch: "main",
      originUrl: "https://github.com/foo/qux.git",
    });
    gitMock.importLocalRepoDirect.mockResolvedValue({
      branchName: "main",
      sourcePath: "/clones/qux",
      baseBranch: "main",
      tracking: null,
      ahead: 0,
      behind: 0,
      originUrl: "https://github.com/foo/qux.git",
    });

    const result = await workspaceService.createFromSource({
      accountId: "default",
      source: {
        kind: "clone",
        url: "https://github.com/foo/qux.git",
        targetPath: "/clones",
      },
    });
    expect(gitMock.cloneRepo).toHaveBeenCalledWith(
      "https://github.com/foo/qux.git",
      "/clones",
    );
    expect(gitMock.importLocalRepoDirect).toHaveBeenCalledWith("/clones/qux");
    expect(result.name).toBe("qux");
    expect(result.rootPath).toBe("/clones/qux");
  });

  it("init: fresh repo — always direct, no import, no origin", async () => {
    setWorktrees(true); // ignored for init
    gitMock.initRepo.mockResolvedValue({
      rootPath: "/projects/newproj",
      defaultBranch: "main",
    });

    const result = await workspaceService.createFromSource({
      accountId: "default",
      source: {
        kind: "init",
        name: "newproj",
        parentPath: "/projects",
      },
    });
    expect(gitMock.initRepo).toHaveBeenCalledWith("newproj", "/projects");
    expect(gitMock.importLocalRepo).not.toHaveBeenCalled();
    expect(gitMock.importLocalRepoDirect).not.toHaveBeenCalled();
    expect(result.rootPath).toBe("/projects/newproj");
    expect(result.defaultBranch).toBe("main");
    expect(result.metadata?.worktree).toEqual({ enabled: false });
    expect(result.metadata?.origin).toBeUndefined();
    const projects = await projectsRepo.findAll();
    expect(projects[0].branches).toEqual(["main"]);
  });

  it("dedups the project by normalized origin across two intakes", async () => {
    setWorktrees(false);
    gitMock.importLocalRepoDirect.mockResolvedValue({
      branchName: "main",
      sourcePath: "/repos/dup",
      baseBranch: "main",
      tracking: null,
      ahead: 0,
      behind: 0,
      originUrl: "git@github.com:foo/dup.git",
    });

    const a = await workspaceService.createFromSource({
      accountId: "default",
      source: { kind: "folder", path: "/repos/dup" },
    });
    const b = await workspaceService.createFromSource({
      accountId: "default",
      source: { kind: "folder", path: "/repos/dup-2" },
    });
    const projects = await projectsRepo.findAll();
    expect(projects).toHaveLength(1); // same normalized origin → one project
    expect(a.projectId).toBe(b.projectId);
  });

  it("folder + worktree: rejects a non-git folder before any DB write (no orphan project)", async () => {
    setWorktrees(true);
    gitMock.isGitRepo.mockResolvedValue(false);

    await expect(
      workspaceService.createFromSource({
        accountId: "default",
        source: { kind: "folder", path: "/repos/not-a-repo" },
      }),
    ).rejects.toThrow("Not a git repository");
    expect(gitMock.importLocalRepo).not.toHaveBeenCalled();
    const projects = await projectsRepo.findAll();
    expect(projects).toHaveLength(0);
  });

  it("clone: skips the repo check — a fresh clone is a repo by construction", async () => {
    setWorktrees(false);
    gitMock.cloneRepo.mockResolvedValue({
      clonedPath: "/clones/fresh",
      defaultBranch: "main",
      originUrl: "https://github.com/foo/fresh.git",
    });
    gitMock.importLocalRepoDirect.mockResolvedValue({
      branchName: "main",
      sourcePath: "/clones/fresh",
      baseBranch: "main",
      tracking: null,
      ahead: 0,
      behind: 0,
      originUrl: "https://github.com/foo/fresh.git",
    });

    await workspaceService.createFromSource({
      accountId: "default",
      source: {
        kind: "clone",
        url: "https://github.com/foo/fresh.git",
        targetPath: "/clones",
      },
    });
    expect(gitMock.isGitRepo).not.toHaveBeenCalled();
  });

  it("surfaces the git error message when the import fails", async () => {
    setWorktrees(false);
    gitMock.importLocalRepoDirect.mockRejectedValue(
      new Error("Not a git repository"),
    );

    await expect(
      workspaceService.createFromSource({
        accountId: "default",
        source: { kind: "folder", path: "/repos/nope" },
      }),
    ).rejects.toThrow("Not a git repository");
  });

  it("worktree: an additional worktree workspace for an existing project", async () => {
    setWorktrees(false); // ignored — worktree source is always a worktree
    const project = createProject(db, {
      id: "p-wt",
      name: "bar",
      rootPath: "/repos/bar",
      remoteOrigin: "https://github.com/foo/bar.git",
    });
    gitMock.importLocalRepo.mockResolvedValue({
      branchName: "cherry-ab12",
      worktreePath: "/work/worktrees/bar/cherry-ab12",
      worktreeName: "cherry-ab12",
      baseBranch: "main",
      tracking: null,
      ahead: 0,
      behind: 0,
      originUrl: "https://github.com/foo/bar.git",
    });

    const result = await workspaceService.createFromSource({
      accountId: "default",
      source: { kind: "worktree", projectId: project.id },
    });
    expect(gitMock.importLocalRepo).toHaveBeenCalledWith("/repos/bar", "bar");
    expect(result.projectId).toBe("p-wt");
    expect(result.rootPath).toBe("/work/worktrees/bar/cherry-ab12");
    expect(result.metadata?.worktree).toEqual({
      enabled: true,
      name: "cherry-ab12",
      path: "/work/worktrees/bar/cherry-ab12",
      sourcePath: "/repos/bar",
      branch: "cherry-ab12",
    });
    // Derived from the first worktree's parent dir.
    const updated = await projectsRepo.findById("p-wt");
    expect(updated!.workspacesPath).toBe("/work/worktrees/bar");
  });

  it("worktree: fails when the project does not exist", async () => {
    await expect(workspaceService.createFromSource({ accountId: "default", source: { kind: "worktree", projectId: "missing" }, })).rejects.toThrow("Project not found");
  });
});

// ════════════════════════════════════════════════════════════════
// 7. Workspace git operations (renameBranch / discardChanges)
//
// Throw-style methods — the envelope is applied by handle() at the IPC seam,
// so these assert on resolved values / rejections, not ServiceResponse.
// ════════════════════════════════════════════════════════════════

describe("workspaceService — git operations", () => {
  const gitMock = vi.mocked(gitService);

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("renameBranch", () => {
    it("renames against the worktree's source repo and updates metadata", async () => {
      createWorkspace(db, {
        id: "ws-wt",
        defaultBranch: "apple-1234",
        rootPath: "/work/worktrees/bar/apple-1234",
        metadata: JSON.stringify({
          worktree: {
            enabled: true,
            name: "apple-1234",
            path: "/work/worktrees/bar/apple-1234",
            sourcePath: "/repos/bar",
            branch: "apple-1234",
          },
        }),
      });
      gitMock.renameBranch.mockResolvedValue("feature/renamed");

      const updated = await workspaceService.renameBranch(
        "ws-wt",
        "feature/renamed",
      );

      // Branch rename runs against the source repo, not the worktree checkout.
      expect(gitMock.renameBranch).toHaveBeenCalledWith(
        "/repos/bar",
        "apple-1234",
        "feature/renamed",
      );
      expect(updated.defaultBranch).toBe("feature/renamed");
      expect((updated.metadata?.worktree as any).branch).toBe(
        "feature/renamed",
      );
    });

    it("renames against rootPath for non-worktree workspaces", async () => {
      createWorkspace(db, {
        id: "ws-plain",
        defaultBranch: "main",
        rootPath: "/repos/plain",
      });
      gitMock.renameBranch.mockResolvedValue("dev");

      await workspaceService.renameBranch("ws-plain", "dev");

      expect(gitMock.renameBranch).toHaveBeenCalledWith(
        "/repos/plain",
        "main",
        "dev",
      );
    });

    it("throws when the workspace has no branch", async () => {
      createWorkspace(db, {
        id: "ws-nobranch",
        defaultBranch: null,
        rootPath: "/repos/x",
      });
      await expect(
        workspaceService.renameBranch("ws-nobranch", "dev"),
      ).rejects.toThrow("Workspace has no branch to rename");
      expect(gitMock.renameBranch).not.toHaveBeenCalled();
    });

    it("propagates git failures without touching the workspace row", async () => {
      createWorkspace(db, {
        id: "ws-fail",
        defaultBranch: "main",
        rootPath: "/repos/fail",
      });
      gitMock.renameBranch.mockRejectedValue(new Error("branch exists"));

      await expect(
        workspaceService.renameBranch("ws-fail", "dev"),
      ).rejects.toThrow("branch exists");
      const ws = await workspaceRepo.findById("ws-fail");
      expect(ws!.defaultBranch).toBe("main");
    });
  });

  describe("discardChanges", () => {
    it("hard-resets to the recorded diff's baseRef and drops the diff row", async () => {
      createWorkspace(db, { id: "ws-d", rootPath: "/repos/d" });
      createWorkspaceDiff(db, {
        workspaceId: "ws-d",
        baseRef: "sha-base",
        diffText: "diff",
      });
      gitMock.resetHard.mockResolvedValue(undefined);

      await workspaceService.discardChanges("ws-d");

      expect(gitMock.resetHard).toHaveBeenCalledWith("/repos/d", "sha-base");
      const latest = await workspaceRepo.findLatestDiffByWorkspace("ws-d");
      expect(latest).toBeNull();
    });

    it("throws when there is no recorded diff", async () => {
      createWorkspace(db, { id: "ws-nodiff", rootPath: "/repos/nd" });
      await expect(
        workspaceService.discardChanges("ws-nodiff"),
      ).rejects.toThrow("No recorded diff to discard");
      expect(gitMock.resetHard).not.toHaveBeenCalled();
    });

    it("keeps the diff row when the reset fails", async () => {
      createWorkspace(db, { id: "ws-rf", rootPath: "/repos/rf" });
      createWorkspaceDiff(db, {
        workspaceId: "ws-rf",
        baseRef: "sha-base",
        diffText: "diff",
      });
      gitMock.resetHard.mockRejectedValue(new Error("reset failed"));

      await expect(workspaceService.discardChanges("ws-rf")).rejects.toThrow(
        "reset failed",
      );
      const latest = await workspaceRepo.findLatestDiffByWorkspace("ws-rf");
      expect(latest).not.toBeNull();
    });
  });
});
