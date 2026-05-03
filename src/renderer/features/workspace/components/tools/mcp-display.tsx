import { useState } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { resolveTool } from "../../utils/resolve-tool";

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

// function formatValue(value: unknown, depth = 0): string {
//   if (value === null || value === undefined) return "null";
//   if (typeof value === "string") {
//     if (value.length > 300) return value.substring(0, 300) + "…";
//     return value;
//   }
//   if (typeof value === "number" || typeof value === "boolean")
//     return String(value);
//   if (Array.isArray(value)) {
//     if (depth > 1) return `[${value.length} items]`;
//     return value.map((v) => formatValue(v, depth + 1)).join("\n");
//   }
//   if (typeof value === "object") {
//     if (depth > 1) return JSON.stringify(value);
//     const entries = Object.entries(value as Record<string, unknown>);
//     return entries
//       .map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`)
//       .join("\n");
//   }
//   return String(value);
// }

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

export function McpDisplay({ displayName, icon, params, output, isCompact = false }: McpDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const resolvedIcon = icon ?? resolveTool(displayName).icon;

  const textsFromMetadata = extractMcpContentTexts(output);
  const textsFromParams =
    textsFromMetadata.length === 0 ? extractMcpContentTexts(params) : [];
  const codeSegments =
    textsFromMetadata.length > 0 ? textsFromMetadata : textsFromParams;
  const hideParamsContentRow =
    codeSegments.length > 0 &&
    textsFromMetadata.length === 0 &&
    textsFromParams.length > 0;

  const paramKeys = params ? Object.keys(params) : [];
  const visibleParamKeys = hideParamsContentRow
    ? paramKeys.filter((k) => k !== "content")
    : paramKeys;

  const hasExpandedParams = visibleParamKeys.length > 0;
  const hasCodeBodies = codeSegments.length > 0;
  const canExpand = hasExpandedParams || hasCodeBodies;

  //const totalCodeChars = codeSegments.join("").length;
  // const summary =
  //   hasCodeBodies &&
  //   textsFromMetadata.length > 0 &&
  //   output !== undefined &&
  //   output !== null
  //     ? `output (${JSON.stringify(output).length} chars)`
  //     : hasCodeBodies
  //       ? `content (${totalCodeChars} chars)`
  //       : paramKeys.length > 0
  //         ? `{${paramKeys.join(", ")}} (${JSON.stringify(params).length} chars)`
  //         : "No params";

  return (
    <div className="">
      <button
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1  text-s font-sans ${canExpand ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            {resolvedIcon}
          </span>
        )}
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
          {displayName}
        </span>
        {/* <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">{summary}</span> */}
        {canExpand && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {canExpand && (
        <div
          className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2 pt-1">
              {hasCodeBodies && (
                <div>
                  <div className="mt-1">
                    <McpOutputCodeBlocks rawTexts={codeSegments} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
