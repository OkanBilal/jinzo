import { chatService } from "./chat.service";
import type { ChatRequestBody } from "./chat.dto";

// ─────────────────────────────────────────────────────────────
// Chat Controller
// ─────────────────────────────────────────────────────────────
export const chatController = {
  // Session operations
  async getSessions() {
    return chatService.getSessions();
  },

  async getSessionById(sessionId: number) {
    return chatService.getSessionById(sessionId);
  },

  async createSession(payload: ChatRequestBody) {
    return chatService.createSession(payload);
  },

  async updateSessionTitle(sessionId: number, title: string) {
    return chatService.updateSessionTitle(sessionId, title);
  },

  async generateTitle(sessionId: number, model?: string) {
    return chatService.generateTitle(sessionId, model);
  },

  async deleteSession(sessionId: number) {
    return chatService.deleteSession(sessionId);
  },

  // Message operations
  async getMessages(sessionId: number) {
    return chatService.getMessages(sessionId);
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
  ) {
    return chatService.saveMessage(sessionId, role, content, model, options);
  },
};
