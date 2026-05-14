import type { RunEvent, RunArtifact, ToolCall } from "../types";
import { formatToolData } from "./format-tool-data";
import { parseToolContent } from "./parse-tool-content";

function parseMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return undefined;
    }
  }
  return metadata as Record<string, unknown>;
}

function parseRawInput(input: unknown): Record<string, unknown> | undefined {
  if (!input) return undefined;
  try {
    return typeof input === "string"
      ? JSON.parse(input)
      : (input as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

/** Convert a RunArtifact to a displayable RunEvent. Always returns an event (fallback on parse error). */
export function mapArtifactToEvent(artifact: RunArtifact): RunEvent {
  try {
    return {
      id: `artifact-${artifact.id}`,
      type: artifact.kind === "log" ? "log" : "artifact",
      content: artifact.content || artifact.path || JSON.stringify(artifact),
      timestamp: artifact.createdAt ? new Date(artifact.createdAt) : new Date(),
      metadata: { ...parseMetadata(artifact.metadata), kind: artifact.kind },
    };
  } catch {
    return {
      id: `artifact-${artifact.id}`,
      type: artifact.kind === "log" ? "log" : "artifact",
      content: artifact.content || artifact.path || String(artifact),
      timestamp: new Date(),
      metadata: { kind: artifact.kind },
    };
  }
}

/** Convert a ToolCall to a displayable RunEvent. Returns null on parse error. */
export function mapToolCallToEvent(tc: ToolCall): RunEvent | null {
  try {
    const inputDisplay = formatToolData(tc.input);
    const outputDisplay = formatToolData(tc.output);
    const content = `${tc.toolName}: ${inputDisplay}${outputDisplay ? `\n→ ${outputDisplay}` : ""}`;

    return {
      id: `tool-${tc.id}`,
      type: "tool_call",
      content,
      timestamp: tc.createdAt ? new Date(tc.createdAt) : new Date(),
      metadata: {
        status: tc.status,
        toolName: tc.toolName,
        input: parseRawInput(tc.input),
        output: tc.output,
        // Pre-parsed once at event-creation time so `ToolCallItem` doesn't
        // re-`JSON.parse` the content string on every render.
        parsed: parseToolContent(content),
      },
    };
  } catch (err) {
    console.error("Error parsing tool call:", tc, err);
    return null;
  }
}
