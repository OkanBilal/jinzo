import ollama from "ollama";
import { chatRepo } from "./chat.repo";
import { DEFAULT_MODEL } from "./chat.constants";
import type {
  ChatRequestBody,
  ServiceResponse,
  SessionResponse,
  MessageResponse,
} from "./chat.dto";

// ─────────────────────────────────────────────────────────────
// Chat Service
// ─────────────────────────────────────────────────────────────
export const chatService = {
  // ─────────────────────────────────────────────────────────────
  // Session Operations
  // ─────────────────────────────────────────────────────────────
  async getSessions(): Promise<ServiceResponse<{ sessions: SessionResponse[] }>> {
    try {
      const rows = await chatRepo.findAllSessions();
      return {
        success: true,
        data: {
          sessions: rows.map((row) => ({
            id: row.id,
            title: row.title,
            initialQuery: row.initialQuery,
            providerId: row.providerId,
            model: row.model,
            moodId: row.moodId,
            systemPromptSnapshot: row.systemPromptSnapshot,
            providerConfigSnapshot: row.providerConfigSnapshot,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to list chat sessions:", error);
      return { success: false, error: "Failed to list sessions" };
    }
  },

  async getSessionById(sessionId: number): Promise<ServiceResponse<SessionResponse>> {
    try {
      if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await chatRepo.findSessionById(sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }

      return {
        success: true,
        data: {
          id: session.id,
          title: session.title,
          initialQuery: session.initialQuery,
          providerId: session.providerId,
          model: session.model,
          moodId: session.moodId,
          systemPromptSnapshot: session.systemPromptSnapshot,
          providerConfigSnapshot: session.providerConfigSnapshot,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
      };
    } catch (error) {
      console.error("Failed to get chat session:", error);
      return { success: false, error: "Failed to get session" };
    }
  },

  async createSession(
    payload: ChatRequestBody
  ): Promise<ServiceResponse<{ sessionId: number }>> {
    try {
      const question = payload.question?.trim();
      if (!question) {
        return { success: false, error: "Question is required" };
      }

      const model = payload.model || DEFAULT_MODEL;

      const sessionId = await chatRepo.insertSession({
        initialQuery: question,
        model,
        title: question.slice(0, 60),
      });

      if (!sessionId) {
        throw new Error("Failed to create chat session: No ID returned");
      }

      // Save user message
      await this.saveMessage(sessionId, "user", question, model);

      return { success: true, data: { sessionId } };
    } catch (error: unknown) {
      console.error("Failed to create chat session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async updateSessionTitle(
    sessionId: number,
    title: string
  ): Promise<ServiceResponse<{ title: string }>> {
    try {
      if (!sessionId || typeof sessionId !== "number") {
        return { success: false, error: "Invalid session ID" };
      }

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return { success: false, error: "Invalid title" };
      }

      const session = await chatRepo.findSessionById(sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }

      await chatRepo.updateSession(sessionId, { title: title.trim() });

      return { success: true, data: { title: title.trim() } };
    } catch (error: unknown) {
      console.error("Failed to update chat session title:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async generateTitle(
    sessionId: number,
    model?: string
  ): Promise<ServiceResponse<{ title: string }>> {
    try {
      if (!sessionId || typeof sessionId !== "number") {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await chatRepo.findSessionById(sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }

      const messages = await chatRepo.getFirstMessages(sessionId, 4);

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
          temperature: 0.8,
        },
      });

      const generatedTitle =
        response.message.content?.trim().slice(0, 60) || session.title || "Untitled";

      await chatRepo.updateSession(sessionId, { title: generatedTitle });

      return { success: true, data: { title: generatedTitle } };
    } catch (error: unknown) {
      console.error("Failed to generate chat session title:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async deleteSession(sessionId: number): Promise<ServiceResponse<void>> {
    try {
      if (!sessionId || typeof sessionId !== "number") {
        return { success: false, error: "Invalid session ID" };
      }

      const session = await chatRepo.findSessionById(sessionId);
      if (!session) {
        return { success: false, error: "Session not found" };
      }

      await chatRepo.deleteSession(sessionId);

      return { success: true };
    } catch (error: unknown) {
      console.error("Failed to delete chat session:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Message Operations
  // ─────────────────────────────────────────────────────────────
  async getMessages(
    sessionId: number
  ): Promise<ServiceResponse<{ messages: MessageResponse[] }>> {
    try {
      if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
        return { success: false, error: "Invalid session ID" };
      }

      const messages = await chatRepo.findMessagesBySessionId(sessionId);

      return {
        success: true,
        data: {
          messages: messages.map((msg) => ({
            id: msg.id,
            sessionId: msg.sessionId,
            role: msg.role,
            content: msg.content,
            providerId: msg.providerId,
            model: msg.model,
            traceId: msg.traceId,
            latencyMs: msg.latencyMs,
            inputTokens: msg.inputTokens,
            outputTokens: msg.outputTokens,
            toolCallGroupId: msg.toolCallGroupId,
            createdAt: msg.createdAt,
          })),
        },
      };
    } catch (error) {
      console.error("Failed to load chat messages:", error);
      return { success: false, error: "Failed to load messages" };
    }
  },

  async saveMessage(
    sessionId: number,
    role: "system" | "user" | "assistant" | "tool",
    content: string,
    model?: string,
    options?: {
      providerId?: string;
      traceId?: string;
      latencyMs?: number;
      inputTokens?: number;
      outputTokens?: number;
      toolCallGroupId?: string;
    }
  ): Promise<number | undefined> {
    if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
      console.warn("Cannot persist message: invalid session ID provided", sessionId);
      return undefined;
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Message content cannot be empty");
    }

    try {
      const session = await chatRepo.findSessionById(sessionId);
      if (!session) {
        console.warn("Cannot persist message: session does not exist", sessionId);
        return undefined;
      }

      const messageId = await chatRepo.insertMessage({
        sessionId,
        role,
        content,
        model,
        providerId: options?.providerId,
        traceId: options?.traceId,
        latencyMs: options?.latencyMs,
        inputTokens: options?.inputTokens,
        outputTokens: options?.outputTokens,
        toolCallGroupId: options?.toolCallGroupId,
      });

      await chatRepo.updateSessionTimestamp(sessionId);

      return messageId;
    } catch (error) {
      throw new Error(
        `Failed to add chat message: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
};
