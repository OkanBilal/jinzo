import {
  type Extension,
  StateField,
  RangeSetBuilder,
} from "@codemirror/state";
import {
  type DecorationSet,
  Decoration,
  EditorView,
  WidgetType,
} from "@codemirror/view";

// ── Types ─────────────────────────────────────────────────

export interface Finding {
  lineStart: number | null;
  lineEnd: number | null;
  severity: string;
  message: string;
  reason: string;
  suggestion: string | null;
}

type Severity = "critical" | "warning" | "info";

function asSeverity(s: string): Severity {
  if (s === "critical" || s === "warning" || s === "info") return s;
  return "info";
}

function severityRank(s: Severity): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

// ── Line highlight decorations ────────────────────────────

const lineDeco = {
  critical: Decoration.line({ class: "cm-finding-line-critical" }),
  warning: Decoration.line({ class: "cm-finding-line-warning" }),
  info: Decoration.line({ class: "cm-finding-line-info" }),
};

// ── Inline annotation widget (always visible) ─────────────

class FindingAnnotationWidget extends WidgetType {
  constructor(
    readonly findings: Finding[],
    readonly isDark: boolean,
  ) {
    super();
  }

  eq(other: FindingAnnotationWidget) {
    return (
      this.findings.length === other.findings.length &&
      this.findings.every((f, i) => f.message === other.findings[i].message)
    );
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-finding-annotation";

    for (const f of this.findings) {
      const card = document.createElement("div");
      const sev = asSeverity(f.severity);
      card.className = `cm-finding-card cm-finding-card-${sev}`;

      // Severity pill
      const pill = document.createElement("span");
      pill.className = `cm-finding-pill cm-finding-pill-${sev}`;
      pill.textContent = sev;
      card.appendChild(pill);

      // Message
      const msg = document.createElement("span");
      msg.className = "cm-finding-message";
      msg.textContent = f.message;
      card.appendChild(msg);

      // Reason
      if (f.reason) {
        const reason = document.createElement("p");
        reason.className = "cm-finding-reason";
        reason.textContent = f.reason;
        card.appendChild(reason);
      }

      // Suggestion
      if (f.suggestion) {
        const sug = document.createElement("p");
        sug.className = "cm-finding-suggestion";
        const label = document.createElement("span");
        label.className = "cm-finding-suggestion-label";
        label.textContent = "Suggestion: ";
        sug.appendChild(label);
        sug.appendChild(document.createTextNode(f.suggestion));
        card.appendChild(sug);
      }

      wrap.appendChild(card);
    }

    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

// ── Build helpers ─────────────────────────────────────────

function buildLineDecorations(
  findings: Finding[],
  doc: { lines: number; line(n: number): { from: number } },
): DecorationSet {
  const lineSet = new Map<number, Severity>();
  for (const f of findings) {
    if (f.lineStart == null) continue;
    const start = f.lineStart;
    const end = f.lineEnd ?? start;
    const sev = asSeverity(f.severity);
    for (let ln = start; ln <= end; ln++) {
      if (ln < 1 || ln > doc.lines) continue;
      const existing = lineSet.get(ln);
      if (!existing || severityRank(sev) > severityRank(existing)) {
        lineSet.set(ln, sev);
      }
    }
  }

  const builder = new RangeSetBuilder<Decoration>();
  const sorted = [...lineSet.entries()].sort((a, b) => a[0] - b[0]);
  for (const [ln, sev] of sorted) {
    const pos = doc.line(ln).from;
    builder.add(pos, pos, lineDeco[sev]);
  }
  return builder.finish();
}

function buildInlineAnnotations(
  byLine: Map<number, Finding[]>,
  isDarkMode: boolean,
  doc: { lines: number; line(n: number): { from: number; to: number } },
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);
  for (const ln of sortedLines) {
    if (ln < 1 || ln > doc.lines) continue;
    const line = doc.line(ln);
    const widget = Decoration.widget({
      widget: new FindingAnnotationWidget(byLine.get(ln)!, isDarkMode),
      side: 1,
      block: true,
    });
    builder.add(line.to, line.to, widget);
  }
  return builder.finish();
}

// ── Main export ───────────────────────────────────────────

export function createFindingsExtension(
  findings: Finding[],
  isDarkMode: boolean,
): Extension[] {
  const valid = findings.filter((f) => f.lineStart != null && f.lineStart > 0);
  if (valid.length === 0) return [];

  // Group findings by line
  const byLine = new Map<number, Finding[]>();
  for (const f of valid) {
    const ln = f.lineStart!;
    const arr = byLine.get(ln) ?? [];
    arr.push(f);
    byLine.set(ln, arr);
  }

  // Line highlight decorations
  const lineDecoField = StateField.define<DecorationSet>({
    create(state) {
      return buildLineDecorations(valid, state.doc);
    },
    update(value, tr) {
      if (tr.docChanged) return buildLineDecorations(valid, tr.state.doc);
      return value;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  // Always-visible inline annotation widgets
  const annotationField = StateField.define<DecorationSet>({
    create(state) {
      return buildInlineAnnotations(byLine, isDarkMode, state.doc);
    },
    update(value, tr) {
      if (tr.docChanged)
        return buildInlineAnnotations(byLine, isDarkMode, tr.state.doc);
      return value;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  // Theme
  const findingsTheme = EditorView.theme(
    {
      ".cm-finding-line-critical": {
        backgroundColor: isDarkMode ? "#6f6e69" : "#ef444414",
      },
      ".cm-finding-line-warning": {
        backgroundColor: isDarkMode ? "#f59e0b1f" : "#f59e0b14",
      },
      ".cm-finding-line-info": {
        backgroundColor: isDarkMode ? "#3b82f61a" : "#3b82f60f",
      },
      // Inline annotation container
      ".cm-finding-annotation": {
        padding: "8px 0 8px 0px",
        maxWidth: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      },
      // Card per finding
      ".cm-finding-card": {
        borderLeft: "3px solid transparent",
        padding: "12px 12px",
        marginBottom: "2px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      },
      ".cm-finding-card-critical": {
        backgroundColor: isDarkMode
          ? "#6f6e6940"
          : "rgba(239,68,68,0.05)",
      },
      ".cm-finding-card-warning": {
        backgroundColor: isDarkMode
        ? "#6f6e6940"
        : "rgba(245,158,11,0.05)",
      },
      ".cm-finding-card-info": {
        backgroundColor: isDarkMode
        ? "#6f6e6940"
        : "rgba(59,130,246,0.05)",
      },
      // Severity pill
      ".cm-finding-pill": {
        display: "inline-block",
        fontSize: "10px",
        fontWeight: "600",
        textTransform: "capitalize",
        letterSpacing: "0.05em",
        padding: "1px 6px",
        borderRadius: "8px",
        marginRight: "8px",
        verticalAlign: "middle",
      },
      ".cm-finding-pill-critical": {
        backgroundColor: isDarkMode ? "#ef444433" : "#ef444426",
        color: isDarkMode ? "#f44336" : "#dc2626",
      },
      ".cm-finding-pill-warning": {
        backgroundColor: isDarkMode ? "#f59e0b33" : "#f59e0b26",
        color: isDarkMode ? "#fcd34d" : "#d97706",
      },
      ".cm-finding-pill-info": {
        backgroundColor: isDarkMode ? "#3b82f633" : "#3b82f626",
        color: isDarkMode ? "#93c5fd" : "#2563eb",
      },
      // Message (inline with pill)
      ".cm-finding-message": {
        fontSize: "12px",
        fontWeight: "500",
        color: isDarkMode ? "#e7e5e4" : "#1c1917",
        verticalAlign: "middle",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      },
      // Reason
      ".cm-finding-reason": {
        fontSize: "11px",
        color: isDarkMode ? "#a8a29e" : "#78716c",
        margin: "4px 0 0 0",
        lineHeight: "1.4",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      },
      // Suggestion
      ".cm-finding-suggestion": {
        fontSize: "12px",
        color: isDarkMode ? "#86efac" : "#16a34a",
        margin: "3px 0 0 0",
        lineHeight: "1.4",
        overflowWrap: "break-word",
        wordBreak: "break-word",
      },
      ".cm-finding-suggestion-label": {
        fontWeight: "600",
      },
    },
    { dark: isDarkMode },
  );

  return [lineDecoField, annotationField, findingsTheme];
}
