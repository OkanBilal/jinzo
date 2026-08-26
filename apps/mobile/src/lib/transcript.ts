import type { RunArtifactRow, ToolCallRow } from "@/db/schema";

import { promptFileFromPath, type PromptFile, type PromptSkill } from "./prompt-chips";

/**
 * The phone's transcript layout — a port of the rules in the desktop's
 * `group-events.ts`: artifacts and tool calls interleaved by time, each
 * artifact classified by its `kind`, and a run of consecutive tool calls folded
 * into one block.
 *
 *  - "user-prompt"            → a prompt bubble
 *  - "thinking", subagent     → hidden (UI-only on desktop too)
 *  - "prompt_suggestion"      → hidden (no composer on the phone yet)
 *  - "image"                  → a placeholder line (blobs never sync)
 *  - kind "log" artifacts     → hidden unless they are errors
 *  - anything else            → an assistant message
 *
 * The fold is the phone's own call. The desktop can afford to list thirty tool
 * rows under a turn; here a stretch of them becomes a single "Worked for 24s"
 * line that opens, so scrolling a transcript means scrolling what was *said*.
 */
export type TranscriptItem =
  | {
      key: string;
      kind: "prompt";
      text: string;
      at: number;
      /** Structured context the prompt carried — what its chips are drawn from. */
      skills: PromptSkill[];
      files: PromptFile[];
    }
  | { key: string; kind: "response"; text: string; at: number }
  | { key: string; kind: "tools"; calls: ToolCallRow[]; at: number }
  | { key: string; kind: "note"; text: string; at: number };

/** Pre-fold shape: one entry per tool call, before consecutive ones merge. */
type FlatItem =
  | Exclude<TranscriptItem, { kind: "tools" }>
  | { key: string; kind: "tool"; call: ToolCallRow; at: number };

interface ArtifactMetadata {
  level?: unknown;
  isFromSubagent?: unknown;
  /** Present on a user prompt: the skills and files the composer attached. */
  skills?: unknown;
  files?: unknown;
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

function artifactItem(artifact: RunArtifactRow): FlatItem | null {
  const meta = metadataOf(artifact);
  const at = artifact.createdAt.getTime();
  const key = `artifact-${artifact.id}`;

  if (meta.isFromSubagent) return null;

  // The `kind` *column* is the discriminator, not anything inside the metadata
  // blob. The desktop reads `metadata.kind` only because its event mapper
  // stamps `{ ...parseMetadata(row.metadata), kind: row.kind }` on the way out
  // — the column always wins there. The adapter writes the prompt as
  // `kind: "user-prompt"` with `metadata: { source: "user" }`, so keying off
  // the metadata here filed every prompt under "assistant message".
  switch (artifact.kind) {
    case "log": {
      const level = typeof meta.level === "string" ? meta.level : "";
      if (level !== "error" || !artifact.content) return null;
      return { key, kind: "note", text: artifact.content, at };
    }
    case "thinking":
    case "prompt_suggestion":
      return null;
    case "user-prompt":
      return artifact.content
        ? {
            key,
            kind: "prompt",
            text: artifact.content,
            at,
            skills: promptSkills(meta),
            files: promptFiles(meta),
          }
        : null;
    case "image":
      return { key, kind: "note", text: `Image${artifact.path ? ` · ${artifact.path}` : ""}`, at };
    default: {
      const text = artifact.content ?? artifact.path ?? "";
      return text ? { key, kind: "response", text, at } : null;
    }
  }
}

/** `metadata.skills` — the composer's own records, passed through unchanged. */
function promptSkills(meta: ArtifactMetadata): PromptSkill[] {
  if (!Array.isArray(meta.skills)) return [];
  return meta.skills.filter(
    (s): s is PromptSkill =>
      Boolean(s) && typeof s === "object" && typeof (s as PromptSkill).name === "string",
  );
}

/** `metadata.files` — `{ path }` records; the chip needs the basename too. */
function promptFiles(meta: ArtifactMetadata): PromptFile[] {
  if (!Array.isArray(meta.files)) return [];
  const out: PromptFile[] = [];
  for (const entry of meta.files) {
    if (!entry || typeof entry !== "object") continue;
    const path = (entry as { path?: unknown }).path;
    if (typeof path === "string" && path) out.push(promptFileFromPath(path));
  }
  return out;
}

export function buildTranscript(
  artifacts: RunArtifactRow[],
  calls: ToolCallRow[],
): TranscriptItem[] {
  const flat: FlatItem[] = [];
  for (const artifact of artifacts) {
    const item = artifactItem(artifact);
    if (item) flat.push(item);
  }
  for (const call of calls) {
    flat.push({ key: `tool-${call.id}`, kind: "tool", call, at: call.createdAt.getTime() });
  }

  // Same tie-break as the desktop: on equal timestamps artifacts come before
  // tool calls, then by source-row id.
  flat.sort((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    const rank = (i: FlatItem) => (i.kind === "tool" ? 1 : 0);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return numericId(a.key) - numericId(b.key);
  });

  return foldToolRuns(flat);
}

/** Consecutive tool calls become one block, keyed by the first call in it. */
function foldToolRuns(flat: FlatItem[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  let block: { key: string; kind: "tools"; calls: ToolCallRow[]; at: number } | null = null;

  for (const item of flat) {
    if (item.kind === "tool") {
      if (block) {
        block.calls.push(item.call);
      } else {
        block = { key: `tools-${item.call.id}`, kind: "tools", calls: [item.call], at: item.at };
        items.push(block);
      }
      continue;
    }
    block = null;
    items.push(item);
  }

  return items;
}

function numericId(key: string): number {
  const dash = key.lastIndexOf("-");
  const n = dash >= 0 ? Number(key.slice(dash + 1)) : NaN;
  return Number.isFinite(n) ? n : 0;
}
