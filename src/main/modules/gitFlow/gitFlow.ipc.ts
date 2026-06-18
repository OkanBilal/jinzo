// ─────────────────────────────────────────────────────────────
// Git Flow IPC Handlers
// ─────────────────────────────────────────────────────────────

import { ipcMain } from "../../ipc-kit/ipc-main";
import { gitFlowService } from "./gitFlow.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

export function registerGitFlowIpc(): void {
  ipcMain.handle(CHANNELS.gitFlow.getStatus, async (_, workspaceId: string) => {
    return gitFlowService.getStatus(workspaceId);
  });

  ipcMain.handle(
    CHANNELS.gitFlow.commit,
    async (
      _,
      payload: {
        workspaceId: string;
        message?: string;
        includeUnstaged?: boolean;
        providerId?: string;
        model?: string;
        push?: boolean;
      },
    ) => {
      return gitFlowService.commit(payload);
    },
  );

  ipcMain.handle(CHANNELS.gitFlow.push, async (_, workspaceId: string) => {
    return gitFlowService.push(workspaceId);
  });

  ipcMain.handle(
    CHANNELS.gitFlow.createPr,
    async (
      _,
      payload: {
        workspaceId: string;
        title?: string;
        body?: string;
        base?: string;
        draft?: boolean;
        providerId?: string;
        model?: string;
      },
    ) => {
      return gitFlowService.createPr(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.gitFlow.generateCommitMessage,
    async (
      _,
      payload: {
        workspaceId: string;
        providerId: string;
        model?: string;
        includeUnstaged?: boolean;
      },
    ) => {
      return gitFlowService.generateCommitMessage(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.gitFlow.generatePrBody,
    async (
      _,
      payload: { workspaceId: string; providerId: string; model?: string },
    ) => {
      return gitFlowService.generatePrBody(payload);
    },
  );
}

export function unregisterGitFlowIpc(): void {
  [
    CHANNELS.gitFlow.getStatus,
    CHANNELS.gitFlow.commit,
    CHANNELS.gitFlow.push,
    CHANNELS.gitFlow.createPr,
    CHANNELS.gitFlow.generateCommitMessage,
    CHANNELS.gitFlow.generatePrBody,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
