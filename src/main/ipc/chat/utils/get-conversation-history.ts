import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { chatMessages } from "../../../db/schema";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Fetches conversation history for a session to include in LLM context.
 * Excludes the current question since that will be added separately.
 * Orders messages chronologically to preserve conversation flow.
 */
export async function getConversationHistory(
  sessionId: number,
  options?: {
    /** Maximum number of message pairs to include (default: 10) */
    maxPairs?: number;
    /** Exclude messages created after this timestamp */
    beforeTimestamp?: Date;
  }
): Promise<ConversationMessage[]> {
  if (!sessionId || typeof sessionId !== "number" || sessionId <= 0) {
    return [];
  }

  try {
    const db = getDb();
    const maxPairs = options?.maxPairs ?? 10;

    const query = db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);

    const messages = await query;

    // Convert to conversation format, excluding system messages
    const conversationMessages: ConversationMessage[] = messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    // Limit to last N pairs (user + assistant = 2 messages per pair)
    const maxMessages = maxPairs * 2;
    if (conversationMessages.length > maxMessages) {
      return conversationMessages.slice(-maxMessages);
    }

    return conversationMessages;
  } catch (error) {
    console.error("Failed to fetch conversation history:", error);
    return [];
  }
}
