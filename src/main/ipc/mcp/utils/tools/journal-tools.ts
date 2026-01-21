import type { OllamaToolDefinition } from "../types";
import { getDb } from "../../../../db/client";
import { entities } from "../../../../db/schema";
import { eq, and } from "drizzle-orm";
import { BrowserWindow } from "electron";
import {
  getCurrentEditingJournalId,
  type JournalMetadata,
} from "../../../journal";

const JOURNAL_KIND = "journal_entry";

/**
 * Journal tool result structure
 */
export interface JournalAppendResult {
  success: boolean;
  message: string;
  entityId?: string;
  newWordCount?: number;
  error?: string;
}

function parseMetadata(metadataStr: string | null): JournalMetadata {
  if (!metadataStr) {
    return { status: "draft", wordCount: 0 };
  }
  try {
    return JSON.parse(metadataStr) as JournalMetadata;
  } catch {
    return { status: "draft", wordCount: 0 };
  }
}

function serializeMetadata(metadata: JournalMetadata): string {
  return JSON.stringify(metadata);
}

function computeWordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function deriveSummary(body: string | null | undefined): string {
  if (!body) return "";

  const text = body
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();

  if (text.length <= 280) return text;
  const maxLen = 500;
  if (text.length <= maxLen) return text;

  let breakPoint = maxLen;
  const sentenceEnd = text.lastIndexOf(".", maxLen);
  if (sentenceEnd > 200) {
    breakPoint = sentenceEnd + 1;
  } else {
    const spaceIndex = text.lastIndexOf(" ", maxLen);
    if (spaceIndex > 200) {
      breakPoint = spaceIndex;
    }
  }

  return text.slice(0, breakPoint).trim() + (breakPoint < text.length ? "..." : "");
}

/**
 * Broadcast journal update to renderer windows so editor can refresh
 */
function broadcastJournalUpdate(entityId: string, newBody: string, wordCount: number) {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send("journal:contentUpdated", {
      entityId,
      body: newBody,
      wordCount,
    });
  }
}

/**
 * Append text to the currently editing journal
 * This tool is used when the LLM wants to continue/extend the user's writing
 */
export async function appendToJournal(
  textToAppend: string
): Promise<JournalAppendResult> {
  try {
    const entityId = getCurrentEditingJournalId();

    if (!entityId) {
      return {
        success: false,
        message: "No journal is currently being edited. Please open a journal entry first.",
        error: "No active journal",
      };
    }

    if (!textToAppend || textToAppend.trim() === "") {
      return {
        success: false,
        message: "No text provided to append.",
        error: "Empty text",
      };
    }

    const db = getDb();

    // Fetch current entry
    const current = await db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.id, entityId),
          eq(entities.kind, JOURNAL_KIND)
        )
      )
      .limit(1);

    if (!current[0]) {
      return {
        success: false,
        message: "Journal entry not found.",
        error: "Entry not found",
      };
    }

    const currentEntry = current[0];
    const currentBody = currentEntry.body || "";

    // Append the text with proper spacing
    const separator = currentBody.endsWith("\n") || currentBody === "" ? "" : "\n\n";
    const newBody = currentBody + separator + textToAppend;

    // Update metadata
    const currentMetadata = parseMetadata(currentEntry.metadata);
    const newWordCount = computeWordCount(newBody);
    const newMetadata: JournalMetadata = {
      ...currentMetadata,
      wordCount: newWordCount,
    };

    // Update the entity
    await db
      .update(entities)
      .set({
        body: newBody,
        summary: deriveSummary(newBody),
        metadata: serializeMetadata(newMetadata),
        updatedAt: new Date(),
      })
      .where(eq(entities.id, entityId));

    // Broadcast update to renderer so editor refreshes
    broadcastJournalUpdate(entityId, newBody, newWordCount);

    return {
      success: true,
      message: `Successfully appended text to your journal. The entry now has ${newWordCount} words.`,
      entityId,
      newWordCount,
    };
  } catch (error) {
    console.error("Failed to append to journal:", error);
    return {
      success: false,
      message: "Failed to append text to journal.",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export const JOURNAL_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "append_to_journal",
      description:
        "Append or add continuation text to the user's current journal entry. Use this when the user asks you to: write more, continue writing, suggest continuation, extend the text, add to my writing, complete the paragraph, or write the next part. This tool directly appends the provided text to the end of their journal.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "The text to append to the journal. This should be a natural continuation of what the user has already written, matching their writing style and tone.",
          },
        },
        required: ["text"],
      },
    },
  },
];

export async function executeJournalTool(
  toolName: string,
  params: { text?: string }
): Promise<any> {
  switch (toolName) {
    case "append_to_journal":
      if (!params.text) {
        return {
          success: false,
          message: "Text parameter is required for append_to_journal tool.",
          error: "Missing text parameter",
        };
      }
      return appendToJournal(params.text);
    default:
      throw new Error(`Unknown journal tool: ${toolName}`);
  }
}
