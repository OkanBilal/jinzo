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
  critical: { pill: "#f44336", pillBg: "#f4433633", line: "#1a1a1a" },
  warning: { pill: "#fcd34d", pillBg: "#f59e0b33", line: "#1a1a1a" },
  info: { pill: "#93c5fd", pillBg: "#3b82f633", line: "#1a1a1a" },
};

// ── FindingAnnotation (module-scope) ─────────────────────

interface FindingAnnotationColors {
  colors: Record<Severity, { pill: string; pillBg: string; line: string }>;
  textColor: string;
  mutedColor: string;
  suggestionColor: string;
}

function makeFindingAnnotation({ colors, textColor, mutedColor, suggestionColor }: FindingAnnotationColors) {
  return function FindingAnnotation({ metadata }: DiffLineAnnotation<FindingMeta>) {
    const { findings } = metadata!;
    return (
      <div className="finding-annotation">
        {findings.map((f) => {
          const sev = asSeverity(f.severity);
          const c = colors[sev];
          return (
            <div
              key={`${sev}-${f.lineStart}-${f.message}`}
              className="finding-card py-2 my-2 border-b last:border-b-0 dark:border-primary/10 border-primary/20"
              style={{ backgroundColor: c.line }}
            >
              <span
                className="px-1 py-0.5 text-xxs rounded-sm capitalize mr-2"
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
                <p className="mt-2" style={{ color: suggestionColor }}>
                  <span className="">Suggestion: </span>
                  {f.suggestion}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };
}

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
  const textColor = isDarkMode ? "#fff" : "#1c1917";
  const mutedColor = isDarkMode ? "#dad8ce" : "#78716c";
  const suggestionColor = isDarkMode ? "#86efac" : "#16a34a";

  const renderAnnotation = useMemo(
    () => makeFindingAnnotation({ colors, textColor, mutedColor, suggestionColor }),
    [colors, textColor, mutedColor, suggestionColor],
  );

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <PatchDiff
        patch={diffText}
         style={{ "--diffs-font-size": "12px", "--diffs-font-family": "'Space Mono', monospace" } as React.CSSProperties}
        options={{
          theme: isDarkMode ? "pierre-dark" : "pierre-light",
          themeType: isDarkMode ? "dark" : "light",
          diffStyle: "unified",
          overflow: "wrap",
          disableFileHeader: true,
        }}
        lineAnnotations={lineAnnotations}
        renderAnnotation={lineAnnotations ? renderAnnotation : undefined}
      />
    </div>
  );
}
