import { BrowserWindow } from "electron";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { spaces, appSettings } from "../../../db/schema";
import type { OllamaToolDefinition, SpaceSwitchResult } from "../mcp.dto";

const ACCOUNT_ID = "default";
const SETTINGS_ID = "default";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function broadcastSpaceChange(spaceId: string | null) {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send("space:changed", { activeSpaceId: spaceId });
  }
}

async function ensureAppSettingsRow() {
  const db = getDb();

  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (existing) return existing;

  await db
    .insert(appSettings)
    .values({ id: SETTINGS_ID, accountId: ACCOUNT_ID })
    .onConflictDoNothing();

  const created = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });

  if (!created) {
    throw new Error("Failed to create app settings");
  }

  return created;
}

// ─────────────────────────────────────────────────────────────
// Space Tools
// ─────────────────────────────────────────────────────────────
export async function switchToChatSpace(): Promise<SpaceSwitchResult> {
  try {
    const db = getDb();
    await ensureAppSettingsRow();

    const allSpaces = await db.query.spaces.findMany({
      where: eq(spaces.accountId, ACCOUNT_ID),
    });

    const chatSpace = allSpaces.find((s) => s.slug === "chat" || s.slug === "default");

    if (!chatSpace) {
      await db
        .update(appSettings)
        .set({
          activeSpaceId: null,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(appSettings.id, SETTINGS_ID));

      broadcastSpaceChange(null);

      return {
        success: true,
        space: "chat",
        message: "Successfully switched to chat space.",
      };
    }

    await db
      .update(appSettings)
      .set({
        activeSpaceId: chatSpace.id,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(appSettings.id, SETTINGS_ID));

    broadcastSpaceChange(chatSpace.id);

    return {
      success: true,
      space: "chat",
      message: "Successfully switched to chat space.",
    };
  } catch (error) {
    console.error("Failed to switch to chat space:", error);
    return {
      success: false,
      space: "chat",
      message: "Failed to switch to chat space",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────
export const SPACE_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "switch_to_chat_space",
      description:
        "Switch to chat space. Use this when the user wants to: chat, go back to chat, return to chat, or talk. This returns to the normal chat interface.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Tool Executor
// ─────────────────────────────────────────────────────────────
export async function executeSpaceTool(toolName: string): Promise<SpaceSwitchResult> {
  switch (toolName) {
    case "switch_to_chat_space":
      return switchToChatSpace();
    default:
      throw new Error(`Unknown space tool: ${toolName}`);
  }
}
