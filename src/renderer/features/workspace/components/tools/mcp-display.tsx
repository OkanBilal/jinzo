import { useState } from "react";
import { resolveTool } from "../../utils/resolve-tool";
import { ToolHeader, ToolCollapse } from "./_shared";

interface McpDisplayProps {
  displayName: string;
  /** Pre-resolved icon. When omitted, falls back to looking it up by name. */
  icon?: React.ReactNode;
  params: Record<string, unknown> | null;
  /** MCP tool call result (`metadata.output`), often `{ content: [{ type: "text", text: string }] }`. */
  output?: unknown;
  isCompact?: boolean;
}

/** Pulls `{ type: "text", text }` bodies from MCP-style `content` arrays. */
function extractMcpContentTexts(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const content = (value as Record<string, unknown>).content;
  if (!Array.isArray(content)) return [];
  const out: string[] = [];
  for (const item of content) {
    if (!item || typeof item !== "object") continue;
    const t = item as { type?: string; text?: string };
    if (t.type === "text" && typeof t.text === "string") {
      out.push(t.text);
    }
  }
  return out;
}

function formatCodePayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** Renders MCP `content[].text` segments inside a monospace/code block shell. */
function McpOutputCodeBlocks({ rawTexts }: { rawTexts: string[] }) {
  return (
    <div className="space-y-1.5">
      {rawTexts.map((text, i) => (
        <pre
          key={i}
          className="noscrollbar text-xs text-primary-950 dark:text-primary whitespace-pre-wrap font-mono bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-64 overflow-y-auto "
        >
          <code>{formatCodePayload(text)}</code>
        </pre>
      ))}
    </div>
  );
}

/**
 * Compact, single-line preview of the input params shown next to the verb in
 * the header. Picks string-ish values, joins with " · ", truncates long ones.
 */
// function summarizeInput(params: Record<string, unknown> | null): string {
//   if (!params) return "";
//   const parts: string[] = [];
//   for (const [key, value] of Object.entries(params)) {
//     if (key === "content" && Array.isArray(value)) continue;
//     if (typeof value === "string") {
//       const trimmed = value.trim();
//       if (trimmed) parts.push(trimmed);
//     } else if (typeof value === "number" || typeof value === "boolean") {
//       parts.push(String(value));
//     } else if (Array.isArray(value) && value.length > 0) {
//       const flat = value
//         .filter((v) => typeof v === "string" || typeof v === "number")
//         .slice(0, 3)
//         .join(", ");
//       if (flat) parts.push(flat);
//     }
//     if (parts.length >= 2) break;
//   }
//   return parts.join(" · ");
// }

export function McpDisplay({ displayName, icon, output, isCompact = false }: McpDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const resolvedIcon = icon ?? resolveTool(displayName).icon;

  const outputTexts = extractMcpContentTexts(output);
  //const inputSummary = summarizeInput(params);
  const hasOutput = outputTexts.length > 0;

  return (
    <div>
      <ToolHeader
        icon={resolvedIcon}
        verb={displayName}
        hasDetails={hasOutput}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >

      </ToolHeader>

      {hasOutput && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="pt-1">
            <McpOutputCodeBlocks rawTexts={outputTexts} />
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
