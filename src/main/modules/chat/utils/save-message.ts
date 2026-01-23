import { eq } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { chatMessages, chatSessions } from "../../../db/schema";

export async function saveMessage(
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