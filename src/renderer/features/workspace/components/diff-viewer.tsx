import { useMemo } from "react";
import { PatchDiff, type DiffLineAnnotation } from "@pierre/diffs/react";
import {
  useGetReviewsByWorkspaceQuery,
  useGetReviewFindingsByReviewQuery,
} from "@/lib/redux/api";

interface Finding {
  lineStart: number | null;
  lineEnd: number | null;
  severity: string;
  message: string;
  reason: string;
  suggestion: string | null;
}

interface FindingMeta {
  findings: Finding[];
}

interface DiffViewerProps {
  diffText: string;
  filename?: string;
  className?: string;
  workspaceId?: string;
  filePath?: string;
}

// ── Severity helpers ─────────────────────────────────────

type Severity = "critical" | "warning" | "info";

function asSeverity(s: string): Severity {
  if (s === "critical" || s === "warning" || s === "info") return s;
  return "info";
}

const severityColors: Record<Severity, { pill: string; pillBg: string; line: string }> = {
  critical: { pill: "#dc2626", pillBg: "#ef444426", line: "#ef444414" },
  warning: { pill: "#d97706", pillBg: "#f59e0b26", line: "#f59e0b14" },
  info: { pill: "#2563eb", pillBg: "#3b82f626", line: "#3b82f60f" },
};

const severityColorsDark: Record<Severity, { pill: string; pillBg: string; line: string }> = {
  critical: { pill: "#f44336", pillBg: "#ef444433", line: "#6f6e6940" },
  warning: { pill: "#fcd34d", pillBg: "#f59e0b33", line: "#6f6e6940" },
  info: { pill: "#93c5fd", pillBg: "#3b82f633", line: "#6f6e6940" },
};

// ── Custom CSS for findings inside shadow DOM ────────────

const FINDINGS_CSS = `
  .finding-annotation {
    padding: 8px 0;
    max-width: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }
  .finding-card {
    border-left: 3px solid transparent;
    padding: 12px;
    margin-bottom: 2px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .finding-pill {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: capitalize;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 8px;
    margin-right: 8px;
    vertical-align: middle;
  }
  .finding-message {
    font-size: 12px;
    font-weight: 500;
    vertical-align: middle;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .finding-reason {
    font-size: 11px;
    margin: 4px 0 0 0;
    line-height: 1.4;
    overflow-wrap: break-word;
    word-break: break-word;
    opacity: 0.7;
  }
  .finding-suggestion {
    font-size: 12px;
    margin: 3px 0 0 0;
    line-height: 1.4;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .finding-suggestion-label {
    font-weight: 600;
  }
`;

// ── Component ─────────────────────────────────────────────

export function DiffViewer({
  diffText,
  className = "",
  workspaceId,
  filePath,
}: DiffViewerProps) {
  const isDarkMode = document.documentElement.classList.contains("dark");

  // Fetch latest review + findings for this file
  const { data: reviews } = useGetReviewsByWorkspaceQuery(
    { workspaceId: workspaceId! },
    { skip: !workspaceId },
  );
  const latestReviewId = reviews?.[0]?.id;

  const { data: allFindings } = useGetReviewFindingsByReviewQuery(
    { reviewId: latestReviewId! },
    { skip: !latestReviewId },
  );

  const fileFindings = useMemo(() => {
    if (!allFindings || !filePath) return [];
    const norm = (p: string) => p.replace(/^\.?\//, "");
    const target = norm(filePath);
    return allFindings.filter((f) => {
      const fNorm = norm(f.file);
      return fNorm === target || fNorm.endsWith("/" + target) || target.endsWith("/" + fNorm);
    });
  }, [allFindings, filePath]);

  // Build line annotations for @pierre/diffs
  const lineAnnotations = useMemo(() => {
    if (fileFindings.length === 0) return undefined;

    // Group findings by line
    const byLine = new Map<number, Finding[]>();
    for (const f of fileFindings) {
      if (f.lineStart == null || f.lineStart < 1) continue;
      const arr = byLine.get(f.lineStart) ?? [];
      arr.push(f);
      byLine.set(f.lineStart, arr);
    }

    const annotations: DiffLineAnnotation<FindingMeta>[] = [];
    for (const [lineNumber, findings] of byLine) {
      annotations.push({
        side: "additions",
        lineNumber,
        metadata: { findings },
      });
    }
    return annotations;
  }, [fileFindings]);

  const colors = isDarkMode ? severityColorsDark : severityColors;
  const textColor = isDarkMode ? "#e7e5e4" : "#1c1917";
  const mutedColor = isDarkMode ? "#a8a29e" : "#78716c";
  const suggestionColor = isDarkMode ? "#86efac" : "#16a34a";

  const renderAnnotation = useMemo(() => {
    return (annotation: DiffLineAnnotation<FindingMeta>) => {
      const { findings } = annotation.metadata!;
      return (
        <div className="finding-annotation">
          {findings.map((f, i) => {
            const sev = asSeverity(f.severity);
            const c = colors[sev];
            return (
              <div
                key={i}
                className="finding-card"
                style={{ backgroundColor: c.line }}
              >
                <span
                  className="finding-pill"
                  style={{ backgroundColor: c.pillBg, color: c.pill }}
                >
                  {sev}
                </span>
                <span className="finding-message" style={{ color: textColor }}>
                  {f.message}
                </span>
                {f.reason && (
                  <p className="finding-reason" style={{ color: mutedColor }}>
                    {f.reason}
                  </p>
                )}
                {f.suggestion && (
                  <p className="finding-suggestion" style={{ color: suggestionColor }}>
                    <span className="finding-suggestion-label">Suggestion: </span>
                    {f.suggestion}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    };
  }, [colors, textColor, mutedColor, suggestionColor]);

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <PatchDiff
        patch={diffText}
         style={{ "--diffs-font-size": "12px", "--diffs-font-family": "'Geist Mono', monospace" } as React.CSSProperties}
        options={{
          theme: isDarkMode ? "pierre-dark" : "pierre-light",
          themeType: isDarkMode ? "dark" : "light",
          diffStyle: "unified",
          overflow: "scroll",
          disableFileHeader: true,
          unsafeCSS: FINDINGS_CSS,
        }}
        lineAnnotations={lineAnnotations}
        renderAnnotation={lineAnnotations ? renderAnnotation : undefined}
      />
    </div>
  );
}
