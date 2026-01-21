import { ipcMain } from "electron";
import { eq, desc } from "drizzle-orm";
import ollama from "ollama";

import { getDb } from "../../db/client";
import { chatSessions, chatMessages } from "../../db/schema";

import { saveMessage, validateChatRequest } from "./utils";
import { ChatRequestBody } from "./types";
import { normalizeChatRequest } from "./utils/validation";
import { DEFAULT_MODEL } from "./config";

export function registerSessionHandlers() {
  // Get chat sessions list
  ipcMain.handle("chat:getSessions", async () => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          initialQuery: chatSessions.initialQuery,
          model: chatSessions.model,
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
        })
        .from(chatSessions)
        .orderBy(desc(chatSessions.id))
        .limit(100);

      return {
        success: true,
        data: {
          sessions: rows.map((row) => ({
            id: row.id,
            title: row.title,
            initialQuery: row.initialQuery,
            model: row.model,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to list chat sessions:", error);
      return { success: false, error: "Failed to list sessions" };
    }
  });

  // Get single session by ID
  ipcMain.handle("chat:getSessionById", async (_, sessionId: number) => {
    try {
      const db = getDb();
      if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      return {
        success: true,
        data: {
          id: session.id,
          title: session.title,
          initialQuery: session.initialQuery,
          model: session.model,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      };
    } catch (error) {
      console.error("Failed to get chat session:", error);
      return { success: false, error: "Failed to get session" };
    }
  });

  // Create chat session
  ipcMain.handle("chat:createSession", async (_, payload: ChatRequestBody) => {
    try {
      const db = getDb();
      const validation = validateChatRequest(payload);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { question, model } = normalizeChatRequest(payload);

      const sessionInsert = await db
        .insert(chatSessions)
        .values({
          initialQuery: question,
          model,
          title: question.slice(0, 60),
        })
        .returning({ id: chatSessions.id });

      if (!sessionInsert[0]) {
        throw new Error("Failed to create chat session: No ID returned");
      }

      const sessionId = sessionInsert[0].id;

      await saveMessage(sessionId, "user", question, model);

      return { success: true, data: { sessionId } };
    } catch (error: any) {
      console.error("Failed to create chat session:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });

  // Update chat session title
  ipcMain.handle(
    "chat:updateTitle",
    async (_, sessionId: number, title: string) => {
      try {
        const db = getDb();
        if (!sessionId || typeof sessionId !== "number") {
          return { success: false, error: "Invalid session ID" };
        }

        if (!title || typeof title !== "string" || title.trim().length === 0) {
          return { success: false, error: "Invalid title" };
        }

        const session = await db.query.chatSessions.findFirst({
          where: eq(chatSessions.id, sessionId),
        });

        if (!session) {
          return { success: false, error: "Session not found" };
        }

        await db
          .update(chatSessions)
          .set({ title: title.trim() })
          .where(eq(chatSessions.id, sessionId));

        return { success: true, data: { title: title.trim() } };
      } catch (error: any) {
        console.error("Failed to update chat session title:", error);
        return { success: false, error: error?.message || "Unknown error" };
      }
    }
  );

  // Generate title for chat session using LLM
  ipcMain.handle(
    "chat:generateTitle",
    async (_, sessionId: number, model?: string) => {
      try {
        const db = getDb();
        if (!sessionId || typeof sessionId !== "number") {
          return { success: false, error: "Invalid session ID" };
        }

        const session = await db.query.chatSessions.findFirst({
          where: eq(chatSessions.id, sessionId),
        });

        if (!session) {
          return { success: false, error: "Session not found" };
        }

        // Get the first few messages from the session
        const messages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, sessionId))
          .orderBy(chatMessages.createdAt)
          .limit(4);

        if (messages.length < 2) {
          return {
            success: false,
            error: "Not enough messages to generate title",
          };
        }

        const userMessage = messages.find((m) => m.role === "user");
        const assistantMessage = messages.find((m) => m.role === "assistant");

        if (!userMessage || !assistantMessage) {
          return {
            success: false,
            error: "Need both user and assistant messages",
          };
        }

        const selectedModel = model || session.model || DEFAULT_MODEL;

        // Generate title using LLM
        const response = await ollama.chat({
          model: selectedModel,
          stream: false,
          messages: [
            {
              role: "system",
              content: `You are a title generator. Generate a short, concise title (3-6 words) that summarizes the conversation topic. Respond with ONLY the title, no quotes, no punctuation at the end, no explanation.`,
            },
            {
              role: "user",
              content: `User asked: "${userMessage.content.slice(0, 500)}"\n\nAssistant replied: "${assistantMessage.content.slice(0, 500)}"\n\nGenerate a short title for this conversation:`,
            },
          ],
          options: {
            temperature: 0.3,
          },
        });

        const generatedTitle =
          response.message.content?.trim().slice(0, 60) || session.title;

        // Update the session title
        await db
          .update(chatSessions)
          .set({ title: generatedTitle })
          .where(eq(chatSessions.id, sessionId));

        return { success: true, data: { title: generatedTitle } };
      } catch (error: any) {
        console.error("Failed to generate chat session title:", error);
        return { success: false, error: error?.message || "Unknown error" };
      }
    }
  );

  // Delete chat session
  ipcMain.handle("chat:deleteSession", async (_, sessionId: number) => {
    try {
      const db = getDb();
      if (!sessionId || typeof sessionId !== "number") {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

      return { success: true };
    } catch (error: any) {
      console.error("Failed to delete chat session:", error);
      return { success: false, error: error?.message || "Unknown error" };
    }
  });
}

export function unregisterSessionHandlers() {
  ipcMain.removeHandler("chat:getSessions");
  ipcMain.removeHandler("chat:getSessionById");
  ipcMain.removeHandler("chat:createSession");
  ipcMain.removeHandler("chat:updateTitle");
  ipcMain.removeHandler("chat:generateTitle");
  ipcMain.removeHandler("chat:deleteSession");
}
