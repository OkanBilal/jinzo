import type { JournalMetadata, FeedEventSnapshot } from "./journal.dto";

// ─────────────────────────────────────────────────────────────
// Rate Limit State
// ─────────────────────────────────────────────────────────────
const lastSaveEventTime = new Map<string, number>();

// ─────────────────────────────────────────────────────────────
// Current Editing Journal State
// ─────────────────────────────────────────────────────────────
let currentEditingJournalId: string | null = null;

export function getCurrentEditingJournalId(): string | null {
  return currentEditingJournalId;
}

export function setCurrentEditingJournalId(id: string | null): void {
  currentEditingJournalId = id;
}

// ─────────────────────────────────────────────────────────────
// Rate Limit Helpers
// ─────────────────────────────────────────────────────────────
export function getLastSaveEventTime(entityId: string): number {
  return lastSaveEventTime.get(entityId) || 0;
}

export function setLastSaveEventTime(entityId: string, time: number): void {
  lastSaveEventTime.set(entityId, time);
}

// ─────────────────────────────────────────────────────────────
// Metadata Helpers
// ─────────────────────────────────────────────────────────────
export function serializeMetadata(metadata: JournalMetadata): string {
  return JSON.stringify(metadata);
}

export function parseMetadata(metadataStr: string | null): JournalMetadata {
  if (!metadataStr) {
    return { status: "draft", wordCount: 0 };
  }
  try {
    return JSON.parse(metadataStr) as JournalMetadata;
  } catch {
    return { status: "draft", wordCount: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
// Content Helpers
// ─────────────────────────────────────────────────────────────
export function computeWordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function deriveSummary(body: string | null | undefined): string {
  if (!body) return "";

  // Simple markdown stripping - remove common markdown syntax
  const text = body
    .replace(/^#+\s*/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/__([^_]+)__/g, "$1") // bold underscores
    .replace(/_([^_]+)_/g, "$1") // italic underscores
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
    .replace(/^[-*+]\s+/gm, "") // list items
    .replace(/^\d+\.\s+/gm, "") // numbered lists
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/\n{2,}/g, " ") // multiple newlines
    .replace(/\n/g, " ") // single newlines
    .trim();

  // Return first 280-500 chars, preferring to break at sentence/word boundary
  if (text.length <= 280) return text;

  const maxLen = 500;
  if (text.length <= maxLen) return text;

  // Find a good break point
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

export function createFeedEventSnapshot(
  status: string,
  wordCount: number,
  includeChars?: number
): string {
  const snapshot: FeedEventSnapshot = { status, wordCount };
  if (includeChars !== undefined) {
    snapshot.chars = includeChars;
  }
  return JSON.stringify(snapshot);
}
