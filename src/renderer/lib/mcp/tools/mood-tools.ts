import type { OllamaToolDefinition } from "../types";
import { getDb } from "../../../../main/db/client";
import { moods, appSettings } from "../../../../main/db/schema";
import { eq, sql } from "drizzle-orm";
import { BrowserWindow } from "electron";

const ACCOUNT_ID = "default";
const SETTINGS_ID = "default";

/**
 * Mood switch result structure
 */
export interface MoodSwitchResult {
  success: boolean;
  mood: string;
  message: string;
  error?: string;
}

/**
 * Broadcast mood change to all renderer windows
 */
function broadcastMoodChange(moodId: string | null) {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send("mood:changed", { activeMoodId: moodId });
  }
}

/**
 * Ensure app settings row exists
 */
async function ensureAppSettingsRow() {
  const db = getDb();
  
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (existing) {
    return existing;
  }

  // Create default settings
  await db
    .insert(appSettings)
    .values({ 
      id: SETTINGS_ID, 
      accountId: ACCOUNT_ID,
    })
    .onConflictDoNothing();

  const created = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (!created) {
    throw new Error("Failed to create app settings");
  }

  return created;
}

/**
 * Switch to journal mood
 * This activates the journal mood which shows the BlockNote editor
 */
export async function switchToJournalMood(): Promise<MoodSwitchResult> {
  try {
    const db = getDb();
    
    // Ensure app settings row exists
    await ensureAppSettingsRow();
    
    // Get moods from database
    const allMoods = await db.query.moods.findMany({
      where: eq(moods.accountId, ACCOUNT_ID),
    });
    
    const journalMood = allMoods.find((m) => m.slug === "journal");

    if (!journalMood) {
      return {
        success: false,
        mood: "journal",
        message: "Journal mood not found. Please create a mood with slug 'journal' first.",
        error: "Mood not found",
      };
    }

    // Set the active mood in app settings
    await db
      .update(appSettings)
      .set({ 
        activeMoodId: journalMood.id,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, SETTINGS_ID));

    // Notify renderer of mood change
    broadcastMoodChange(journalMood.id);

    return {
      success: true,
      mood: "journal",
      message: "Successfully switched to journal mood. The editor is now ready for you to write.",
    };
  } catch (error) {
    console.error("Failed to switch to journal mood:", error);
    return {
      success: false,
      mood: "journal",
      message: "Failed to switch to journal mood",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Switch to chat mood (default)
 * This deactivates journal mood and returns to normal chat
 */
export async function switchToChatMood(): Promise<MoodSwitchResult> {
  try {
    const db = getDb();
    
    // Ensure app settings row exists
    await ensureAppSettingsRow();
    
    // Get moods from database
    const allMoods = await db.query.moods.findMany({
      where: eq(moods.accountId, ACCOUNT_ID),
    });
    
    const chatMood = allMoods.find((m) => m.slug === "chat" || m.slug === "default");

    if (!chatMood) {
      // If no chat mood exists, set to null to deactivate
      await db
        .update(appSettings)
        .set({ 
          activeMoodId: null,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(appSettings.id, SETTINGS_ID));

      // Notify renderer of mood change
      broadcastMoodChange(null);

      return {
        success: true,
        mood: "chat",
        message: "Successfully switched to chat mood.",
      };
    }

    // Set the active mood in app settings
    await db
      .update(appSettings)
      .set({ 
        activeMoodId: chatMood.id,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, SETTINGS_ID));

    // Notify renderer of mood change
    broadcastMoodChange(chatMood.id);

    return {
      success: true,
      mood: "chat",
      message: "Successfully switched to chat mood.",
    };
  } catch (error) {
    console.error("Failed to switch to chat mood:", error);
    return {
      success: false,
      mood: "chat",
      message: "Failed to switch to chat mood",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export const MOOD_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "switch_to_journal_mood",
      description:
        "Switch to journal mood. Use this when the user wants to: write, start writing, open editor, enter journal mood, write something, create a document, or compose text. This activates the BlockNote editor on the home screen.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_to_chat_mood",
      description:
        "Switch to chat mood. Use this when the user wants to: chat, go back to chat, exit journal mood, leave editor, return to chat, or talk. This returns to the normal chat interface.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export async function executeMoodTool(
  toolName: string,
): Promise<any> {
  switch (toolName) {
    case "switch_to_journal_mood":
      return switchToJournalMood();
    case "switch_to_chat_mood":
      return switchToChatMood();
    default:
      throw new Error(`Unknown mood tool: ${toolName}`);
  }
}
