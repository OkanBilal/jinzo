import { eq } from "drizzle-orm";

import { getDb } from "../../../main/db/client";
import { chatSessions, chatMessages } from "../../../main/db/schema";
import { responseCache } from "../../../renderer/lib/rag/cache";
import { ChatResponse } from "../../../renderer/lib/chat/types";

async function saveMessage(
  sessionId: number,
  role: "user" | "assistant",
  content: string,
  model: string
): Promise<void> {
  if (!sessionId || typeof sessionId !== 'number' || sessionId <= 0) {
    console.warn("Cannot persist message: invalid session ID provided", sessionId);
    return;
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Message content cannot be empty");
  }

  try {
    const db = getDb();
    
    // Verify session exists before inserting message
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });
    
    if (!session) {
      console.warn("Cannot persist message: session does not exist", sessionId);
      return;
    }
    
    const result = await db
      .insert(chatMessages)
      .values({ sessionId, role, content, model })
      .returning({ id: chatMessages.id });

    if (!result[0]) {
      throw new Error("Failed to add chat message: No ID returned");
    }

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  } catch (error) {
    throw new Error(
      `Failed to add chat message: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

function generateCacheKey(question: string, model: string) {
  return { question, model };
}

function getCachedResponse(
  question: string,
  model: string,
  sessionId: number | null,
  noCache?: boolean
): ChatResponse | null {
  if (noCache) {
    return null;
  }

  const cacheKey = generateCacheKey(question, model);
  const cachedAnswer = responseCache.get(cacheKey);

  if (!cachedAnswer) {
    return null;
  }

  console.log("✓ Response cache hit");

  return {
    answer: cachedAnswer as string,
    sessionId,
    sources: [],
    metadata: {
      queryType: "cached",
      totalRetrieved: 0,
      usedInContext: 0,
      cached: true,
    },
  };
}

export { saveMessage, getCachedResponse };
