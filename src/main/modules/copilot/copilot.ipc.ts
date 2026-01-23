import { ipcMain } from "electron";
import { copilotController } from "./copilot.controller";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────
const IPC_CHANNELS = {
  CHAT: "copilot:chat",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerCopilotHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CHAT, async (_event, prompt: string) => {
    return copilotController.chat(prompt);
  });
}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterCopilotHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
