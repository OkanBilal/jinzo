import { ipcMain } from "electron";
import { chatController } from "./chat.controller";
import { getChatConfig, updateChatConfig } from "./chat.config";
import { handleChatMode, handleRAGMode, handleToolMode } from "./modes";
import {
  getCachedResponse,
  sendStreamError,
  validateChatRequest,
} from "./utils";
import { normalizeChatRequest } from "./utils/validation";
import { IPC_CHANNELS, DEFAULT_MODEL } from "./chat.constants";
import type { ChatRequestBody, ChatConfig } from "./chat.dto";

// ─────────────────────────────────────────────────────────────
// In-Flight Generation Tracking
// ─────────────────────────────────────────────────────────────
const inFlightGenerations = new Map<number, boolean>();

function markGenerationComplete(userMessageId: number | undefined) {
  if (userMessageId !== undefined) {
    inFlightGenerations.delete(userMessageId);
  }
}

function isGenerationInFlight(userMessageId: number | undefined): boolean {
  if (userMessageId === undefined) {
    return false;
  }
  return inFlightGenerations.has(userMessageId);
}

function markGenerationStarted(userMessageId: number | undefined) {
  if (userMessageId !== undefined) {
    inFlightGenerations.set(userMessageId, true);
  }
}

// ─────────────────────────────────────────────────────────────
// Save Message Helper (uses service)
// ─────────────────────────────────────────────────────────────
async function saveMessage(
  sessionId: number,
  role: "user" | "assistant",
  content: string,
  model: string
): Promise<void> {
  await chatController.saveMessage(sessionId, role, content, model);
}

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerChatHandlers(): void {
  // Get chat config
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, async () => {
    try {
      return { success: true, data: getChatConfig() };
    } catch (error) {
      console.error("Error getting chat config:", error);
      return { success: false, error: "Failed to get chat config" };
    }
  });

  // Update chat config
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_CONFIG,
    async (_event, payload: Partial<ChatConfig>) => {
      try {
        const updatedConfig = updateChatConfig(payload);
        return { success: true, data: updatedConfig };
      } catch (error: unknown) {
        console.error("Error updating chat config:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update config",
        };
      }
    }
  );

  // Session handlers
  ipcMain.handle(IPC_CHANNELS.GET_SESSIONS, async () => {
    return chatController.getSessions();
  });

  ipcMain.handle(
    IPC_CHANNELS.GET_SESSION_BY_ID,
    async (_event, sessionId: number) => {
      return chatController.getSessionById(sessionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CREATE_SESSION,
    async (_event, payload: ChatRequestBody) => {
      return chatController.createSession(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_TITLE,
    async (_event, sessionId: number, title: string) => {
      return chatController.updateSessionTitle(sessionId, title);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GENERATE_TITLE,
    async (_event, sessionId: number, model?: string) => {
      return chatController.generateTitle(sessionId, model);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DELETE_SESSION,
    async (_event, sessionId: number) => {
      return chatController.deleteSession(sessionId);
    }
  );

  // Message handlers
  ipcMain.handle(
    IPC_CHANNELS.GET_MESSAGES,
    async (_event, sessionId: number) => {
      return chatController.getMessages(sessionId);
    }
  );

  // Chat with streaming (main handler)
  ipcMain.handle(IPC_CHANNELS.SEND, async (event, payload: ChatRequestBody) => {
    try {
      const validation = validateChatRequest(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { question, model, sessionId, options } =
        normalizeChatRequest(payload);

      const userMessageId = options.userMessageId;

      if (isGenerationInFlight(userMessageId)) {
        // console.log(
        //   `Generation already in flight for userMessageId: ${userMessageId}, skipping duplicate`
        // );
        return { success: true, skipped: true, reason: "generation_in_flight" };
      }

      if (!options.skipUserSave) {
        await saveMessage(sessionId, "user", question, model);
      }

      const cached = getCachedResponse(
        question,
        model,
        sessionId,
        options.noCache
      );

      if (cached) {
        event.sender.send("chat:stream-chunk", {
          sessionId,
          content: cached.answer,
        });
        event.sender.send("chat:stream-final", cached);
        return { success: true, cached: true };
      }

      const config = getChatConfig();
      const toolMode = (options as Record<string, unknown>).toolMode ?? config.toolMode;

      markGenerationStarted(userMessageId);

      (async () => {
        try {
          if (toolMode === "tool") {
            await handleToolMode(
              question,
              model,
              sessionId,
              options,
              event.sender.id
            );
          } else if (toolMode === "rag") {
            await handleRAGMode(
              question,
              model,
              sessionId,
              options,
              event.sender.id
            );
          } else {
            await handleChatMode(
              question,
              model,
              sessionId,
              options,
              event.sender.id
            );
          }
        } catch (error: unknown) {
          console.error("Chat streaming error:", error);
          sendStreamError(
            event.sender.id,
            sessionId,
            error instanceof Error ? error.message : "Unknown error"
          );
        } finally {
          markGenerationComplete(userMessageId);
        }
      })();

      return { success: true, streaming: true };
    } catch (error: unknown) {
      console.error("Chat send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterChatHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
