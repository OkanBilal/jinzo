import type { RunArtifactRow, ToolCallRow } from "@/db/schema";

/**
 * The phone's transcript layout — a port of the rules in the desktop's
 * `group-events.ts`, minus grouping: artifacts and tool calls interleaved by
 * time, each artifact classified by `metadata.kind`.
 *
 *  - "user-prompt"            → a prompt bubble
 *  - "thinking", subagent     → hidden (UI-only on desktop too)
 *  - "prompt_suggestion"      → hidden (no composer on the phone yet)
 *  - "image"                  → a placeholder line (blobs never sync)
 *  - kind "log" artifacts     → hidden unless they are errors
 *  - anything else            → an assistant message
 */
export type TranscriptItem =
  | { key: string; kind: "prompt"; text: string; at: number }
  | { key: string; kind: "response"; text: string; at: number; live: boolean }
  | { key: string; kind: "tool"; call: ToolCallRow; at: number }
  | { key: string; kind: "note"; text: string; at: number };

interface ArtifactMetadata {
  kind?: unknown;
  level?: unknown;
  isFromSubagent?: unknown;
}

function metadataOf(artifact: RunArtifactRow): ArtifactMetadata {
  if (!artifact.metadataJson) return {};
  try {
    const parsed: unknown = JSON.parse(artifact.metadataJson);
    return parsed && typeof parsed === "object" ? (parsed as ArtifactMetadata) : {};
  } catch {
    return {};
  }
}

function artifactItem(artifact: RunArtifactRow): TranscriptItem | null {
  const meta = metadataOf(artifact);
  const at = artifact.createdAt.getTime();
  const key = `artifact-${artifact.id}`;

  if (meta.isFromSubagent) return null;

  if (artifact.kind === "log") {
    const level = typeof meta.level === "string" ? meta.level : "";
    if (level !== "error" || !artifact.content) return null;
    return { key, kind: "note", text: artifact.content, at };
  }

  switch (meta.kind) {
    case "thinking":
    case "prompt_suggestion":
      return null;
    case "user-prompt":
      return artifact.content ? { key, kind: "prompt", text: artifact.content, at } : null;
    case "image":
      return { key, kind: "note", text: `Image${artifact.path ? ` · ${artifact.path}` : ""}`, at };
    default: {
      const text = artifact.content ?? artifact.path ?? "";
      return text ? { key, kind: "response", text, at, live: false } : null;
    }
  }
}

export function buildTranscript(
  artifacts: RunArtifactRow[],
  calls: ToolCallRow[],
  runIsLive: boolean,
): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (const artifact of artifacts) {
    const item = artifactItem(artifact);
    if (item) items.push(item);
  }
  for (const call of calls) {
    items.push({ key: `tool-${call.id}`, kind: "tool", call, at: call.createdAt.getTime() });
  }

  // Same tie-break as the desktop: on equal timestamps artifacts come before
  // tool calls, then by source-row id.
  items.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    const rank = (i: TranscriptItem) => (i.kind === "tool" ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return numericId(a.key) - numericId(b.key);
  });

  // A running agent whose last visible item isn't a message is still
  // working: show it, so the screen never looks finished while it isn't.
  const last = items[items.length - 1];
  if (runIsLive) {
    if (last && last.kind === "response") {
      last.live = true;
    } else {
      items.push({
        key: "live-placeholder",
        kind: "response",
        text: "",
        at: Number.MAX_SAFE_INTEGER,
        live: true,
      });
    }
  }
  return items;
}

function numericId(key: string): number {
  const dash = key.lastIndexOf("-");
  const n = dash >= 0 ? Number(key.slice(dash + 1)) : NaN;
  return Number.isFinite(n) ? n : 0;
}
