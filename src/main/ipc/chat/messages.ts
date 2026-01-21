import { ipcMain } from "electron";
import { eq } from "drizzle-orm";

import { getDb } from "../../db/client";
import { chatMessages } from "../../db/schema";

export function registerMessageHandlers() {
  // Get messages for a session
  ipcMain.handle("chat:getMessages", async (_, sessionId: number) => {
    try {
      const db = getDb();
      if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
        return { success: false, error: "Invalid session ID" };
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      return {
        success: true,
        data: {
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to load chat messages:", error);
      return { success: false, error: "Failed to load messages" };
    }
  });
}

export function unregisterMessageHandlers() {
  ipcMain.removeHandler("chat:getMessages");
}
