import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { chatSessions, chatMessages } from "../../db/schema";
import type {
  CreateSessionPayload,
  UpdateSessionPayload,
  CreateMessagePayload,
} from "./chat.dto";

// ─────────────────────────────────────────────────────────────
// Chat Repository
// ─────────────────────────────────────────────────────────────
export const chatRepo = {
  // ─────────────────────────────────────────────────────────────
  // Session Operations
  // ─────────────────────────────────────────────────────────────
  async findAllSessions(limit = 100) {
    const db = getDb();
    return db
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        initialQuery: chatSessions.initialQuery,
        providerId: chatSessions.providerId,
        model: chatSessions.model,
        moodId: chatSessions.moodId,
        systemPromptSnapshot: chatSessions.systemPromptSnapshot,
        providerConfigSnapshot: chatSessions.providerConfigSnapshot,
        createdAt: chatSessions.createdAt,
        updatedAt: chatSessions.updatedAt,
      })
      .from(chatSessions)
      .orderBy(desc(chatSessions.id))
      .limit(limit);
  },

  async findSessionById(sessionId: number) {
    const db = getDb();
    return db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });
  },

  async insertSession(payload: CreateSessionPayload) {
    const db = getDb();
    const result = await db
      .insert(chatSessions)
      .values({
        initialQuery: payload.initialQuery,
        model: payload.model,
        title: payload.title,
        providerId: payload.providerId,
        moodId: payload.moodId,
        systemPromptSnapshot: payload.systemPromptSnapshot,
        providerConfigSnapshot: payload.providerConfigSnapshot,
      })
      .returning({ id: chatSessions.id });

    return result[0]?.id;
  },

  async updateSession(sessionId: number, payload: UpdateSessionPayload) {
    const db = getDb();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.providerId !== undefined) updateData.providerId = payload.providerId;
    if (payload.model !== undefined) updateData.model = payload.model;
    if (payload.moodId !== undefined) updateData.moodId = payload.moodId;
    if (payload.systemPromptSnapshot !== undefined)
      updateData.systemPromptSnapshot = payload.systemPromptSnapshot;
    if (payload.providerConfigSnapshot !== undefined)
      updateData.providerConfigSnapshot = payload.providerConfigSnapshot;

    await db
      .update(chatSessions)
      .set(updateData)
      .where(eq(chatSessions.id, sessionId));

    return this.findSessionById(sessionId);
  },

  async updateSessionTimestamp(sessionId: number) {
    const db = getDb();
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  },

  async deleteSession(sessionId: number) {
    const db = getDb();
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  },

  // ─────────────────────────────────────────────────────────────
  // Message Operations
  // ─────────────────────────────────────────────────────────────
  async findMessagesBySessionId(sessionId: number) {
    const db = getDb();
    return db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        role: chatMessages.role,
        content: chatMessages.content,
        providerId: chatMessages.providerId,
        model: chatMessages.model,
        traceId: chatMessages.traceId,
        latencyMs: chatMessages.latencyMs,
        inputTokens: chatMessages.inputTokens,
        outputTokens: chatMessages.outputTokens,
        toolCallGroupId: chatMessages.toolCallGroupId,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  },

  async insertMessage(payload: CreateMessagePayload) {
    const db = getDb();
    const result = await db
      .insert(chatMessages)
      .values({
        sessionId: payload.sessionId,
        role: payload.role,
        content: payload.content,
        providerId: payload.providerId,
        model: payload.model,
        traceId: payload.traceId,
        latencyMs: payload.latencyMs,
        inputTokens: payload.inputTokens,
        outputTokens: payload.outputTokens,
        toolCallGroupId: payload.toolCallGroupId,
      })
      .returning({ id: chatMessages.id });

    return result[0]?.id;
  },

  async getFirstMessages(sessionId: number, limit = 4) {
    const db = getDb();
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
  },
};
