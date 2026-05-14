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

  return (
    <div>
      <ToolHeader
        icon={resolvedIcon}
        verb={displayName}
        hasDetails={canExpand}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      />

      {canExpand && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="space-y-2 pt-1">
            {hasCodeBodies && (
              <div>
                <div className="mt-1">
                  <McpOutputCodeBlocks rawTexts={codeSegments} />
                </div>
              </div>
            )}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
