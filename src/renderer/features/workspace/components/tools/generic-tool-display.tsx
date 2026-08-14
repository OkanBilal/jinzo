import { useState, type ReactNode } from "react";
import { ToolHeader, ToolCollapse, ToolOutputBody, useToolStatus } from "./_shared";
import { toolOutputText, previewParams } from "../../utils/parse-tool-content";

/** Guardrail so a huge param blob (a 200 KB `Write`) never lands in the DOM. */
const MAX_BODY_CHARS = 4000;

function toOneLine(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function prettyJson(value: unknown): string {
  try {
    const text = JSON.stringify(value, null, 2);
    if (!text) return "";
    return text.length > MAX_BODY_CHARS
      ? `${text.slice(0, MAX_BODY_CHARS)}\n… (${text.length - MAX_BODY_CHARS} more chars)`
      : text;
  } catch {
    return "";
  }
}

function clamp(text: string): string {
  return text.length > MAX_BODY_CHARS
    ? `${text.slice(0, MAX_BODY_CHARS)}\n… (${text.length - MAX_BODY_CHARS} more chars)`
    : text;
}

interface GenericToolDisplayProps {
  icon: ReactNode;
  displayName: string;
  params: Record<string, unknown> | null;
  output?: unknown;
  /** Pre-computed summary from `parseToolContent`; used when params yield nothing. */
  summary?: string;
  isCompact?: boolean;
}

/**
 * Terminal fallback for any tool without a dedicated renderer — a provider we
 * haven't registered, a newly shipped SDK tool, or a plugin's own. Everything
 * is derived generically, so an unrecognized tool still gets the same
 * affordances as a first-class one: a status-aware header (spinner while
 * running, red on failure) and an expandable body showing the full input and
 * output. Without this, an unknown tool renders as a dead single line and its
 * result is unreachable in the UI.
 */
export function GenericToolDisplay({
  icon,
  displayName,
  params,
  output,
  summary,
  isCompact = false,
}: GenericToolDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = useToolStatus();

  const inputJson = params && Object.keys(params).length > 0 ? prettyJson(params) : "";
  const outputText = clamp(toolOutputText(output));

  // Params are the richer source; `summary` is the parsed-content fallback for
  // events whose input never survived as an object.
  const preview = previewParams(params) || toOneLine(summary ?? "");

  // In compact mode `ToolHeader` hides the icon and verb, so without a preview
  // the row would render empty — fall back to the tool's own name.
  const headerText = preview || (isCompact ? displayName : "");

  const hasDetails = !!inputJson || !!outputText;

  return (
    <div>
      <ToolHeader
        icon={icon}
        verb={displayName}
        hasDetails={hasDetails}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {headerText && (
          <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            {headerText}
          </span>
        )}
      </ToolHeader>

      {hasDetails && (
        <ToolCollapse isExpanded={isExpanded}>
          <ToolOutputBody as="div" className="text-s font-sans space-y-2 max-h-64">
            {inputJson && (
              <div className="space-y-1">
                <div className="text-t font-medium text-primary-600 dark:text-primary-400">
                  Input
                </div>
                <pre className="noscrollbar whitespace-pre-wrap wrap-break-word font-mono text-t">
                  {inputJson}
                </pre>
              </div>
            )}

            {outputText && (
              <div
                className={`space-y-1 ${
                  inputJson ? "pt-1 border-t border-primary-100 dark:border-primary/10" : ""
                }`}
              >
                <div className="text-t font-medium text-primary-600 dark:text-primary-400">
                  {status === "error" ? "Error" : "Output"}
                </div>
                <pre
                  className={`noscrollbar whitespace-pre-wrap wrap-break-word font-mono text-t ${
                    status === "error" ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {outputText}
                </pre>
              </div>
            )}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}
