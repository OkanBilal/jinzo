import { ok } from "../../../shared/ipc-kit/service-response";
import { ipcMain } from "../../ipc-kit/ipc-main";
import { gitService } from "./git.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerGitIpc(): void {
  ipcMain.handle(CHANNELS.git.isRepo, async (_, rootPath: string) => {
    return gitService.isGitRepo(rootPath);
  });

  ipcMain.handle(CHANNELS.git.getCurrentBranch, async (_, rootPath: string) => {
    return gitService.getCurrentBranch(rootPath);
  });

  ipcMain.handle(CHANNELS.git.getBranches, async (_, rootPath: string) => {
    return gitService.getBranches(rootPath);
  });

  ipcMain.handle(CHANNELS.git.getStatus, async (_, rootPath: string) => {
    return gitService.getStatus(rootPath);
  });

  ipcMain.handle(CHANNELS.git.getLog, async (_, rootPath: string, limit?: number) => {
    return gitService.getLog(rootPath, limit);
  });

  ipcMain.handle(CHANNELS.git.getRemotes, async (_, rootPath: string) => {
    return gitService.getRemotes(rootPath);
  });

  ipcMain.handle(CHANNELS.git.getDiff, async (_, rootPath: string, filePath?: string) => {
    return gitService.getDiff(rootPath, filePath);
  });

  ipcMain.handle(CHANNELS.git.getRepoRoot, async (_, rootPath: string) => {
    return gitService.getRepoRoot(rootPath);
  });

  ipcMain.handle(CHANNELS.git.createBranch, async (_, rootPath: string, branchName: string) => {
    return gitService.createBranch(rootPath, branchName);
  });

  ipcMain.handle(
    CHANNELS.git.createWorktree,
    async (_, rootPath: string, worktreePath: string, branchName: string) => {
      return gitService.createWorktree(rootPath, worktreePath, branchName);
    }
  );

  ipcMain.handle(CHANNELS.git.importLocalRepo, async (_, sourcePath: string, projectName?: string, customBranchName?: string) => {
    return gitService.importLocalRepo(sourcePath, projectName, customBranchName);
  });

  ipcMain.handle(CHANNELS.git.importLocalRepoDirect, async (_, sourcePath: string) => {
    return gitService.importLocalRepoDirect(sourcePath);
  });

  ipcMain.handle(
    CHANNELS.git.renameBranch,
    async (_, rootPath: string, oldName: string, newName: string) => {
      return gitService.renameBranch(rootPath, oldName, newName);
    }
  );

  ipcMain.handle(
    CHANNELS.git.removeWorktree,
    async (_, sourcePath: string, worktreePath: string) => {
      return gitService.removeWorktree(sourcePath, worktreePath);
    }
  );

  ipcMain.handle(CHANNELS.git.getWorktreesDir, async () => {
    return ok(gitService.getWorktreesDir());
  });

  ipcMain.handle(CHANNELS.git.cloneRepo, async (_, url: string, targetPath: string) => {
    return gitService.cloneRepo(url, targetPath);
  });

  ipcMain.handle(CHANNELS.git.initRepo, async (_, projectName: string, parentPath?: string) => {
    return gitService.initRepo(projectName, parentPath);
  });

  ipcMain.handle(CHANNELS.git.resetHard, async (_, rootPath: string, ref: string) => {
    return gitService.resetHard(rootPath, ref);
  });
}

export function unregisterGitIpc(): void {
  [
    CHANNELS.git.isRepo,
    CHANNELS.git.getCurrentBranch,
    CHANNELS.git.getBranches,
    CHANNELS.git.getStatus,
    CHANNELS.git.getLog,
    CHANNELS.git.getRemotes,
    CHANNELS.git.getDiff,
    CHANNELS.git.getRepoRoot,
    CHANNELS.git.createBranch,
    CHANNELS.git.createWorktree,
    CHANNELS.git.importLocalRepo,
    CHANNELS.git.importLocalRepoDirect,
    CHANNELS.git.renameBranch,
    CHANNELS.git.removeWorktree,
    CHANNELS.git.getWorktreesDir,
    CHANNELS.git.cloneRepo,
    CHANNELS.git.initRepo,
    CHANNELS.git.resetHard,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
