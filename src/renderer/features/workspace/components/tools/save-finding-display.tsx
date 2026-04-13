import { useState } from "react";
import { ArrowUp, Jinzo } from "@/components/ui/icons";

interface Finding {
  severity?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  message?: string;
  reason?: string;
  suggestion?: string;
}

export interface SaveFindingParams {
  // Single finding
  reviewId?: string;
  severity?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  message?: string;
  reason?: string;
  suggestion?: string;
  // Batch findings
  findings?: Finding[];
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  warning: "bg-yellow-500/10 text-yellow-400",
  info: "bg-blue-500/10 text-blue-400",
};

export function SaveFindingDisplay({
  params,
  isCompact = false,
}: {
  params: SaveFindingParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize to array of findings
  const findings: Finding[] = params.findings?.length
    ? params.findings
    : params.file
      ? [{ severity: params.severity, file: params.file, lineStart: params.lineStart, lineEnd: params.lineEnd, message: params.message, reason: params.reason, suggestion: params.suggestion }]
      : [];

  const hasFindings = findings.length > 0;

  // Count by severity
  const critical = findings.filter(f => f.severity === "critical").length;
  const warning = findings.filter(f => f.severity === "warning").length;
  const info = findings.filter(f => f.severity === "info").length;

  return (
    <div className="px-2">
      <button
        onClick={() => hasFindings && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasFindings ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasFindings && (
          <ArrowUp
            className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
        {!isCompact && <Jinzo className="w-2 h-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            {findings.length === 1 ? "Finding" : "Findings"}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-primary-400 dark:text-primary-500">
          {critical > 0 && <span className="text-red-400">{critical} critical</span>}
          {warning > 0 && <span className="text-yellow-400">{warning} warning</span>}
          {info > 0 && <span className="text-blue-400">{info} info</span>}
        </span>
        {findings.length === 1 && findings[0].file && (
          <span className="text-primary-500 truncate text-xs font-mono">
            {shortName(findings[0].file)}
          </span>
        )}
      </button>

      {isExpanded && hasFindings && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3 space-y-2">
          {findings.map((f) => (
            <div key={`${f.file ?? ""}:${f.lineStart ?? ""}:${f.severity ?? ""}`} className="bg-primary-50 dark:bg-primary/5 rounded p-2 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                {f.severity && (
                  <span className={`px-1.5 py-0.5 rounded font-medium ${SEVERITY_STYLES[f.severity] ?? "bg-primary-500/10 text-primary-400"}`}>
                    {f.severity}
                  </span>
                )}
                {f.file && (
                  <span className="font-mono text-primary-500">
                    {shortName(f.file)}
                    {f.lineStart != null && `:${f.lineStart}${f.lineEnd != null && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ""}`}
                  </span>
                )}
              </div>
              {f.message && (
                <p className="text-s text-primary-600 dark:text-primary-400">{f.message}</p>
              )}
              {f.suggestion && (
                <p className="text-xs text-green-500 dark:text-green-400 italic">{f.suggestion}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function shortName(path: string): string {
  const parts = path.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : path;
}
