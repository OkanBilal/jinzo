import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";
import { Text, Tiny } from "@/components/ui";
import { SEVERITY_TINT } from "../../lib/severity";
import { shortPath } from "../../utils/path-utils";

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
    <div>
      <ToolHeader
        icon={<Mains className="size-4" />}
        verb="Saved findings"
        hasDetails={hasFindings}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="flex items-center gap-1.5 text-primary-500">
          {critical > 0 && <span className="text-danger">{critical} critical</span>}
          {warning > 0 && <span className="text-warning">{warning} warning</span>}
          {info > 0 && <span className="text-accent">{info} info</span>}
        </span>
        {findings.length === 1 && findings[0].file && (
          <span className="text-primary-500 truncate text-xs font-mono group-hover:text-primary-950 group-hover:dark:text-primary">
            {shortPath(findings[0].file)}
          </span>
        )}
      </ToolHeader>

      {hasFindings && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="space-y-2">
            {findings.map((f) => (
              <div key={`${f.file ?? ""}:${f.lineStart ?? ""}:${f.severity ?? ""}`} className="bg-primary-50 dark:bg-primary/5 rounded-md p-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  {f.severity && (
                    <span className={`px-1.5 py-0.5 rounded font-medium ${(SEVERITY_TINT as Record<string, string>)[f.severity] ?? "bg-primary-500/10 text-primary-500"}`}>
                      {f.severity}
                    </span>
                  )}
                  {f.file && (
                    <span className="font-mono text-primary-950 dark:text-primary">
                      {shortPath(f.file)}
                      {f.lineStart != null && `:${f.lineStart}${f.lineEnd != null && f.lineEnd !== f.lineStart ? `-${f.lineEnd}` : ""}`}
                    </span>
                  )}
                </div>
                {f.message && (
                  <Tiny as="div" className="whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">{f.message}</Tiny>
                )}
                {f.suggestion && (
                  <Text className="text-xs text-success">{f.suggestion}</Text>
                )}
              </div>
            ))}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}

