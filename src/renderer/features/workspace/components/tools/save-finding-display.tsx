import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

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
    <div className="">
      <button
        onClick={() => hasFindings && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasFindings ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="size-3.5 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Saved findings
          </span>
        )}
        <span className="flex items-center gap-1.5 text-primary-500">
          {critical > 0 && <span className="text-red-400">{critical} critical</span>}
          {warning > 0 && <span className="text-yellow-400">{warning} warning</span>}
          {info > 0 && <span className="text-blue-400">{info} info</span>}
        </span>
        {findings.length === 1 && findings[0].file && (
          <span className="text-primary-500 truncate text-xs font-mono group-hover:text-primary-950 group-hover:dark:text-primary">
            {shortName(findings[0].file)}
          </span>
        )}
        {hasFindings && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasFindings && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={`${f.file ?? ""}:${f.lineStart ?? ""}:${f.severity ?? ""}`} className="bg-primary-50 dark:bg-primary/5 rounded-md p-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {f.severity && (
                      <span className={`px-1.5 py-0.5 rounded font-medium ${SEVERITY_STYLES[f.severity] ?? "bg-primary-500/10 text-primary-500"}`}>
                        {f.severity}
                      </span>
                    )}
                    {f.file && (
                        <span className="font-mono text-primary-950 dark:text-primary">
                        {shortName(f.file)}
                        {f.lineStart != null && `:${f.lineStart}${f.lineEnd != null && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ""}`}
                      </span>
                    )}
                  </div>
                  {f.message && (
                    <p className="text-s text-primary-950 dark:text-primary">{f.message}</p>
                  )}
                  {f.suggestion && (
                    <p className="text-xs text-green-600 dark:text-green-400">{f.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shortName(path: string): string {
  const parts = path.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : path;
}
