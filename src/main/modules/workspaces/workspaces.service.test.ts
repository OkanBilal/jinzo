import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createWorkspace, createProject } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  app: {
    getPath: () => "/tmp",
    getName: () => "jinzo",
    getVersion: () => "0.0.0",
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));

vi.mock("child_process", () => ({
  execFile: vi.fn((_shell: string, _args: string[], _opts: unknown, cb: (...args: any[]) => void) => {
    cb(null, "done", "");
  }),
}));

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn(() => true) };
});

import { workspacesService } from "./workspaces.service";
import { workspacesRepo } from "./workspaces.repo";
import { projectsRepo } from "../projects/projects.repo";
import { BrowserWindow } from "electron";
import { execFile } from "child_process";

describe("workspacesService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getAll", () => {
    it("returns success with workspaces", async () => {
      createWorkspace(db, { id: "ws1", name: "WS1" });
      const result = await workspacesService.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty array when none", async () => {
      const result = await workspacesService.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("getById", () => {
    it("returns workspace by id", async () => {
      createWorkspace(db, { id: "ws1", name: "My Workspace" });
      const result = await workspacesService.getById("ws1");
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("My Workspace");
    });

    it("returns error for non-existent", async () => {
      const result = await workspacesService.getById("missing");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Workspace not found");
    });
  });

  describe("getByAccountId", () => {
    it("returns workspaces for account", async () => {
      createWorkspace(db, { id: "ws1", accountId: "default" });
      const result = await workspacesService.getByAccountId("default");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getByRootPath", () => {
    it("returns workspace by root path", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/projects/my-app" });
      const result = await workspacesService.getByRootPath("default", "/projects/my-app");
      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("ws1");
    });

    it("returns error when not found", async () => {
      const result = await workspacesService.getByRootPath("default", "/missing/path");
      expect(result.success).toBe(false);
    });
  });

  describe("create", () => {
    it("creates a new workspace", async () => {
      const result = await workspacesService.create({
        accountId: "default",
        name: "New Workspace",
        rootPath: "/projects/new-ws",
      });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("New Workspace");
      expect(result.data!.id).toBeTruthy();
    });

    it("rejects duplicate root path", async () => {
      createWorkspace(db, { id: "ws1", rootPath: "/projects/existing" });

      const result = await workspacesService.create({
        accountId: "default",
        name: "Duplicate",
        rootPath: "/projects/existing",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Workspace with this path already exists");
    });

    it("generates ID if not provided", async () => {
      const result = await workspacesService.create({
        accountId: "default",
        name: "Auto ID",
        rootPath: "/projects/auto-id",
      });

      expect(result.success).toBe(true);
      expect(result.data!.id).toBeTruthy();
    });
  });

  describe("update", () => {
    it("updates workspace fields", async () => {
      createWorkspace(db, { id: "ws1", name: "Old Name" });
      const result = await workspacesService.update("ws1", { name: "New Name" });

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("New Name");
    });

    it("returns error for non-existent", async () => {
      const result = await workspacesService.update("missing", { name: "Test" });
      expect(result.success).toBe(false);
    });
  });

  describe("delete", () => {
    it("deletes workspace", async () => {
      createWorkspace(db, { id: "ws1" });
      const result = await workspacesService.delete("ws1");
      expect(result.success).toBe(true);

      const check = await workspacesService.getById("ws1");
      expect(check.success).toBe(false);
    });
  });

  describe("updateStatus", () => {
    it("updates workspace status", async () => {
      createWorkspace(db, { id: "ws1" });
      const result = await workspacesService.updateStatus("ws1", "in_progress");
      expect(result.success).toBe(true);
      expect(result.data!.status).toBe("in_progress");
    });
  });

  describe("archive", () => {
    it("archives a workspace", async () => {
      createWorkspace(db, { id: "ws1" });
      const result = await workspacesService.archive("ws1");
      expect(result.success).toBe(true);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error for non-existent workspace", async () => {
      const result = await workspacesService.archive("missing");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Workspace not found");
    });

    it("runs archive script when project has one", async () => {
      const project = createProject(db, {
        id: "p1",
        name: "ScriptProject",
        archiveScript: "echo done",
      });
      createWorkspace(db, { id: "ws1", projectId: project.id });

      const result = await workspacesService.archive("ws1");
      expect(result.success).toBe(true);
      // Script runs fire-and-forget, so we just verify the workspace was archived
    });
  });

  // ─────────────────────────────────────────────────────────────
  // create - with project setup script
  // ─────────────────────────────────────────────────────────────
  describe("create - with project", () => {
    it("creates workspace with projectId and triggers setup script", async () => {
      const project = createProject(db, {
        id: "p1",
        name: "ScriptProject",
        setupScript: "echo setup",
      });

      const result = await workspacesService.create({
        accountId: "default",
        name: "WS with project",
        rootPath: "/projects/with-project",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      expect(result.data!.projectId).toBe("p1");
    });

    it("uses provided id when given", async () => {
      const result = await workspacesService.create({
        id: "custom-id",
        accountId: "default",
        name: "Custom ID",
        rootPath: "/projects/custom-id",
      });

      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("custom-id");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getAll returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findAll").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.getAll();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspaces");
    });

    it("getById returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.getById("ws1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspace");
    });

    it("getByAccountId returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findByAccountId").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.getByAccountId("default");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspaces");
    });

    it("getByRootPath returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findByRootPath").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.getByRootPath("default", "/x");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspace");
    });

    it("create returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findByRootPath").mockResolvedValueOnce(null);
      vi.spyOn(workspacesRepo, "insert").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.create({
        accountId: "default",
        name: "Fail",
        rootPath: "/fail",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create workspace");
    });

    it("update returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "update").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.update("ws1", { name: "X" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update workspace");
    });

    it("delete returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "delete").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.delete("ws1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete workspace");
    });

    it("archive returns error on failure", async () => {
      vi.spyOn(workspacesRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await workspacesService.archive("ws1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to archive workspace");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Uncovered branches: create - failed to retrieve after insert
  // ─────────────────────────────────────────────────────────────
  describe("create - post-insert findById returns null", () => {
    it("returns error when workspace cannot be retrieved after insert", async () => {
      vi.spyOn(workspacesRepo, "findByRootPath").mockResolvedValueOnce(null);
      vi.spyOn(workspacesRepo, "insert").mockResolvedValueOnce("new-id");
      vi.spyOn(workspacesRepo, "findById").mockResolvedValueOnce(null);

      const result = await workspacesService.create({
        accountId: "default",
        name: "Ghost",
        rootPath: "/projects/ghost",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to retrieve created workspace");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Uncovered branches: archive - repo.archive returns null
  // ─────────────────────────────────────────────────────────────
  describe("archive - repo returns null", () => {
    it("returns error when archive repo call returns null", async () => {
      createWorkspace(db, { id: "ws-arch", name: "To Archive" });
      vi.spyOn(workspacesRepo, "archive").mockResolvedValueOnce(null);

      const result = await workspacesService.archive("ws-arch");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to archive workspace");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Uncovered: create fire-and-forget setup script paths
  // ─────────────────────────────────────────────────────────────
  describe("create - setup script execution", () => {
    it("skips setup script when project has no setupScript", async () => {
      const project = createProject(db, {
        id: "p-no-setup",
        name: "NoSetup",
        setupScript: null,
      });
      const result = await workspacesService.create({
        accountId: "default",
        name: "WS no setup",
        rootPath: "/projects/no-setup",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      // Allow microtasks to flush
      await new Promise((r) => setTimeout(r, 50));
    });

    it("notifies renderer on successful setup script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { webContents: { send: mockSend } } as any,
      ]);

      const project = createProject(db, {
        id: "p-setup-ok",
        name: "SetupOK",
        setupScript: "echo hello",
      });

      const result = await workspacesService.create({
        accountId: "default",
        name: "WS setup ok",
        rootPath: "/projects/setup-ok",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      // Allow fire-and-forget promise chain to resolve
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "setup",
        success: true,
      }));
    });

    it("notifies renderer on failed setup script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { webContents: { send: mockSend } } as any,
      ]);

      vi.mocked(execFile).mockImplementationOnce((_shell: any, _args: any, _opts: any, cb: any) => {
        cb(new Error("script crashed"), "", "err");
        return undefined as any;
      });

      const project = createProject(db, {
        id: "p-setup-fail",
        name: "SetupFail",
        setupScript: "exit 1",
      });

      const result = await workspacesService.create({
        accountId: "default",
        name: "WS setup fail",
        rootPath: "/projects/setup-fail",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "setup",
        success: false,
        error: "script crashed",
      }));
    });

    it("silently catches projectsRepo.findById rejection in create", async () => {
      const project = createProject(db, { id: "p-create-catch", name: "CreateCatch" });
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(new Error("db fail"));

      const result = await workspacesService.create({
        accountId: "default",
        name: "WS project fail",
        rootPath: "/projects/project-fail",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
      // No error thrown - the .catch(() => {}) swallows it
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Uncovered: archive fire-and-forget archive script paths
  // ─────────────────────────────────────────────────────────────
  describe("archive - archive script execution", () => {
    it("skips archive script when project has no archiveScript", async () => {
      const project = createProject(db, {
        id: "p-no-archive",
        name: "NoArchive",
        archiveScript: null,
      });
      createWorkspace(db, { id: "ws-no-arch", projectId: project.id });

      const result = await workspacesService.archive("ws-no-arch");
      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
    });

    it("notifies renderer on successful archive script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { webContents: { send: mockSend } } as any,
      ]);

      const project = createProject(db, {
        id: "p-arch-ok",
        name: "ArchOK",
        archiveScript: "echo bye",
      });
      createWorkspace(db, { id: "ws-arch-ok", projectId: project.id });

      const result = await workspacesService.archive("ws-arch-ok");
      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "archive",
        success: true,
      }));
    });

    it("notifies renderer on failed archive script", async () => {
      const mockSend = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { webContents: { send: mockSend } } as any,
      ]);

      vi.mocked(execFile).mockImplementationOnce((_shell: any, _args: any, _opts: any, cb: any) => {
        cb(new Error("archive failed"), "", "err");
        return undefined as any;
      });

      const project = createProject(db, {
        id: "p-arch-fail",
        name: "ArchFail",
        archiveScript: "exit 1",
      });
      createWorkspace(db, { id: "ws-arch-fail", projectId: project.id });

      const result = await workspacesService.archive("ws-arch-fail");
      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "archive",
        success: false,
        error: "archive failed",
      }));
    });

    it("silently catches projectsRepo.findById rejection in archive", async () => {
      const project = createProject(db, { id: "p-arch-catch", name: "ArchCatch" });
      createWorkspace(db, { id: "ws-arch-proj-fail", projectId: project.id });
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(new Error("db fail"));

      const result = await workspacesService.archive("ws-arch-proj-fail");
      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));
      // No error thrown - the .catch(() => {}) swallows it
    });
  });

  // ─────────────────────────────────────────────────────────────
  // notifyRenderer with actual windows
  // ─────────────────────────────────────────────────────────────
  describe("notifyRenderer", () => {
    it("sends to multiple windows", async () => {
      const mockSend1 = vi.fn();
      const mockSend2 = vi.fn();
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        { webContents: { send: mockSend1 } } as any,
        { webContents: { send: mockSend2 } } as any,
      ]);

      const project = createProject(db, {
        id: "p-multi-win",
        name: "MultiWin",
        setupScript: "echo hi",
      });

      const result = await workspacesService.create({
        accountId: "default",
        name: "WS multi win",
        rootPath: "/projects/multi-win",
        projectId: project.id,
      });

      expect(result.success).toBe(true);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSend1).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "setup",
        success: true,
      }));
      expect(mockSend2).toHaveBeenCalledWith("workspaces:scriptComplete", expect.objectContaining({
        script: "setup",
        success: true,
      }));
    });
  });
});
