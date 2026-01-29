import { ipcMain } from "electron";
import { gitService } from "./git.service";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  IS_GIT_REPO: "git:isRepo",
  GET_CURRENT_BRANCH: "git:getCurrentBranch",
  GET_BRANCHES: "git:getBranches",
  GET_STATUS: "git:getStatus",
  GET_LOG: "git:getLog",
  GET_REMOTES: "git:getRemotes",
  GET_DIFF: "git:getDiff",
  GET_REPO_ROOT: "git:getRepoRoot",
  CREATE_BRANCH: "git:createBranch",
  CREATE_WORKTREE: "git:createWorktree",
  IMPORT_LOCAL_REPO: "git:importLocalRepo",
  REMOVE_WORKTREE: "git:removeWorktree",
  GET_WORKTREES_DIR: "git:getWorktreesDir",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerGitIpc(): void {
  ipcMain.handle(CHANNELS.IS_GIT_REPO, async (_, rootPath: string) => {
    return gitService.isGitRepo(rootPath);
  });

  ipcMain.handle(CHANNELS.GET_CURRENT_BRANCH, async (_, rootPath: string) => {
    return gitService.getCurrentBranch(rootPath);
  });

  ipcMain.handle(CHANNELS.GET_BRANCHES, async (_, rootPath: string) => {
    return gitService.getBranches(rootPath);
  });

  ipcMain.handle(CHANNELS.GET_STATUS, async (_, rootPath: string) => {
    return gitService.getStatus(rootPath);
  });

  ipcMain.handle(CHANNELS.GET_LOG, async (_, rootPath: string, limit?: number) => {
    return gitService.getLog(rootPath, limit);
  });

  ipcMain.handle(CHANNELS.GET_REMOTES, async (_, rootPath: string) => {
    return gitService.getRemotes(rootPath);
  });

  ipcMain.handle(CHANNELS.GET_DIFF, async (_, rootPath: string, filePath?: string) => {
    return gitService.getDiff(rootPath, filePath);
  });

  ipcMain.handle(CHANNELS.GET_REPO_ROOT, async (_, rootPath: string) => {
    return gitService.getRepoRoot(rootPath);
  });

  ipcMain.handle(CHANNELS.CREATE_BRANCH, async (_, rootPath: string, branchName: string) => {
    return gitService.createBranch(rootPath, branchName);
  });

  ipcMain.handle(
    CHANNELS.CREATE_WORKTREE,
    async (_, rootPath: string, worktreePath: string, branchName: string) => {
      return gitService.createWorktree(rootPath, worktreePath, branchName);
    }
  );

  ipcMain.handle(CHANNELS.IMPORT_LOCAL_REPO, async (_, sourcePath: string) => {
    return gitService.importLocalRepo(sourcePath);
  });

  ipcMain.handle(
    CHANNELS.REMOVE_WORKTREE,
    async (_, sourcePath: string, worktreePath: string) => {
      return gitService.removeWorktree(sourcePath, worktreePath);
    }
  );

  ipcMain.handle(CHANNELS.GET_WORKTREES_DIR, async () => {
    return { success: true, data: gitService.getWorktreesDir() };
  });
}

export function unregisterGitIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
