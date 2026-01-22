import { ipcMain } from "electron";

import { getChatConfig, updateChatConfig, type ChatConfig } from "./config";
import { registerSessionHandlers, unregisterSessionHandlers } from "./session";
import { registerMessageHandlers, unregisterMessageHandlers } from "./messages";
import { handleChatMode, handleRAGMode, handleMCPMode } from "./modes";
import { getCachedResponse, saveMessage, sendStreamError, validateChatRequest } from "./utils";
import { normalizeChatRequest } from "./utils/validation";
import { ChatRequestBody } from "./types";

// Track in-flight generations by userMessageId to prevent duplicate generations
// Key: userMessageId, Value: true if generation is in progress
const inFlightGenerations = new Map<number, boolean>();

// Clean up completed generation tracking
function markGenerationComplete(userMessageId: number | undefined) {
  if (userMessageId !== undefined) {
    inFlightGenerations.delete(userMessageId);
  }
}

// Check if generation is already in progress for this user message
function isGenerationInFlight(userMessageId: number | undefined): boolean {
  if (userMessageId === undefined) {
    return false;
  }
  return inFlightGenerations.has(userMessageId);
}

// Mark generation as started
function markGenerationStarted(userMessageId: number | undefined) {
  if (userMessageId !== undefined) {
    inFlightGenerations.set(userMessageId, true);
  }
}

export function registerChatHandlers() {
  // Get chat config
  ipcMain.handle("chat:getConfig", async () => {
    try {
      return { success: true, data: getChatConfig() };
    } catch (error) {
      console.error("Error getting chat config:", error);
      return { success: false, error: "Failed to get chat config" };
    }
  });

  // Update chat config
  ipcMain.handle(
    "chat:updateConfig",
    async (_, payload: Partial<ChatConfig>) => {
      try {
        const updatedConfig = updateChatConfig(payload);
        return { success: true, data: updatedConfig };
      } catch (error: any) {
        console.error("Error updating chat config:", error);
        return {
          success: false,
          error: error?.message || "Failed to update config",
        };
      }
    }
  );

  // Register sub-handlers
  registerSessionHandlers();
  registerMessageHandlers();

  // Chat with streaming (main handler)
  ipcMain.handle("chat:send", async (event, payload: ChatRequestBody) => {
    try {
      const validation = validateChatRequest(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { question, model, sessionId, options } =
        normalizeChatRequest(payload);

      // Get userMessageId for idempotency tracking (if provided)
      const userMessageId = options.userMessageId;

      // Check if generation is already in flight for this user message
      // This prevents duplicate generation if user navigates away and back quickly
      if (isGenerationInFlight(userMessageId)) {
        console.log(`Generation already in flight for userMessageId: ${userMessageId}, skipping duplicate`);
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
      const toolMode = (options as any).toolMode ?? config.toolMode;

      // Mark generation as started for this user message
      markGenerationStarted(userMessageId);

      // Start streaming in background
      (async () => {
        try {
          if (toolMode === "mcp") {
            await handleMCPMode(
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
        } catch (error: any) {
          console.error("Chat streaming error:", error);
          sendStreamError(
            event.sender.id,
            sessionId,
            error?.message || "Unknown error"
          );
        } finally {
          // Clean up in-flight tracking when generation completes (success or error)
          markGenerationComplete(userMessageId);
        }
      })();

      return { success: true, streaming: true };
    } catch (error: any) {
      console.error("Chat send error:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });
}

export function unregisterChatHandlers() {
  ipcMain.removeHandler("chat:getConfig");
  ipcMain.removeHandler("chat:updateConfig");
  ipcMain.removeHandler("chat:send");
  unregisterSessionHandlers();
  unregisterMessageHandlers();
}
