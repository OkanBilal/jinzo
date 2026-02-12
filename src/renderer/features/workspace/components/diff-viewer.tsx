import { useRef, useEffect } from "react";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { unifiedMergeView } from "@codemirror/merge";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface DiffViewerProps {
  diffText: string;
  filename?: string;
  className?: string;
}

/** Reconstruct original and modified file content from a unified diff */
function parseDiff(diffText: string): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];
  let inHunk = false;

  for (const line of diffText.split("\n")) {
    // Skip diff headers
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode")
    )
      continue;

    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    if (line.startsWith("-")) {
      originalLines.push(line.slice(1));
    } else if (line.startsWith("+")) {
      modifiedLines.push(line.slice(1));
    } else if (line.startsWith(" ") || line === "") {
      // Context line (or empty)
      const content = line.startsWith(" ") ? line.slice(1) : line;
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return {
    original: originalLines.join("\n"),
    modified: modifiedLines.join("\n"),
  };
}

function getLanguageExtension(filename: string | undefined): Extension | null {
  if (!filename) return null;
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return javascript({ typescript: true, jsx: ext === "tsx" });
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return javascript({ jsx: ext === "jsx" });
    case "json":
      return json();
    case "md":
    case "mdx":
      return markdown();
    case "css":
    case "scss":
    case "less":
      return css();
    case "html":
    case "htm":
    case "xml":
    case "svg":
      return html();
    default:
      return null;
  }
}

// ── Themes (match codemirror-editor.tsx) ───────────────────

const FONT_FAMILY =
  "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#1c1917",
      fontSize: "13px",
      height: "100%",
      fontFamily: FONT_FAMILY,
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: FONT_FAMILY, lineHeight: "1.6" },
    ".cm-content": { padding: "12px 0", fontFamily: FONT_FAMILY },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--color-primary-400)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
      minWidth: "40px",
      fontSize: "12px",
    },
    ".cm-line": { padding: "0 16px" },
    // Merge-view change highlights
    ".cm-changedLine": { backgroundColor: "#0596690f" },
    ".cm-changedText": { backgroundColor: "#0596692e", textDecoration: "none" },
    ".cm-deletedChunk": { backgroundColor: "#dc26260f" },
  },
  { dark: false },
);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#e7e5e4",
      fontSize: "13px",
      height: "100%",
      fontFamily: FONT_FAMILY,
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: FONT_FAMILY, lineHeight: "1.6" },
    ".cm-content": { padding: "12px 0", fontFamily: FONT_FAMILY },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--color-primary-500)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 16px",
      minWidth: "40px",
      fontSize: "12px",
    },
    ".cm-line": { padding: "0 16px" },
    // Merge-view change highlights
    ".cm-changedLine": { backgroundColor: "#10b98114" },
    ".cm-changedText": { backgroundColor: "#10b98138", textDecoration: "none" },
    ".cm-deletedChunk": { backgroundColor: "#ef44441a" },
  },
  { dark: true },
);

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#7c3aed" },
  { tag: tags.controlKeyword, color: "#7c3aed" },
  { tag: tags.moduleKeyword, color: "#7c3aed" },
  { tag: tags.operatorKeyword, color: "#7c3aed" },
  { tag: tags.definitionKeyword, color: "#7c3aed" },
  { tag: tags.operator, color: "#64748b" },
  { tag: tags.separator, color: "#64748b" },
  { tag: tags.punctuation, color: "#64748b" },
  { tag: tags.bracket, color: "#64748b" },
  { tag: tags.string, color: "#059669" },
  { tag: tags.number, color: "#ea580c" },
  { tag: tags.bool, color: "#ea580c" },
  { tag: tags.null, color: "#ea580c" },
  { tag: tags.comment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.lineComment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.variableName, color: "#0f172a" },
  { tag: tags.definition(tags.variableName), color: "#2563eb" },
  { tag: tags.function(tags.variableName), color: "#2563eb" },
  { tag: tags.propertyName, color: "#0891b2" },
  { tag: tags.typeName, color: "#0d9488" },
  { tag: tags.className, color: "#0d9488" },
  { tag: tags.tagName, color: "#dc2626" },
  { tag: tags.attributeName, color: "#ea580c" },
  { tag: tags.attributeValue, color: "#059669" },
  { tag: tags.content, color: "#121212" },
]);

const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c4b5fd" },
  { tag: tags.controlKeyword, color: "#c4b5fd" },
  { tag: tags.moduleKeyword, color: "#c4b5fd" },
  { tag: tags.operatorKeyword, color: "#c4b5fd" },
  { tag: tags.definitionKeyword, color: "#c4b5fd" },
  { tag: tags.operator, color: "#94a3b8" },
  { tag: tags.separator, color: "#94a3b8" },
  { tag: tags.punctuation, color: "#94a3b8" },
  { tag: tags.bracket, color: "#94a3b8" },
  { tag: tags.string, color: "#6ee7b7" },
  { tag: tags.number, color: "#fdba74" },
  { tag: tags.bool, color: "#fdba74" },
  { tag: tags.null, color: "#fdba74" },
  { tag: tags.comment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.lineComment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e2e8f0" },
  { tag: tags.definition(tags.variableName), color: "#93c5fd" },
  { tag: tags.function(tags.variableName), color: "#93c5fd" },
  { tag: tags.propertyName, color: "#67e8f9" },
  { tag: tags.typeName, color: "#5eead4" },
  { tag: tags.className, color: "#5eead4" },
  { tag: tags.tagName, color: "#fca5a5" },
  { tag: tags.attributeName, color: "#fdba74" },
  { tag: tags.attributeValue, color: "#6ee7b7" },
  { tag: tags.content, color: "#e7e5e4" },
]);

// ── Component ─────────────────────────────────────────────

export function DiffViewer({
  diffText,
  filename,
  className = "",
}: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const isDarkMode = document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!containerRef.current || !diffText) return;

    const { original, modified } = parseDiff(diffText);

    const extensions: Extension[] = [
      lineNumbers(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      unifiedMergeView({
        original,
        gutter: true,
        syntaxHighlightDeletions: true,
        highlightChanges: false,
        mergeControls: false,
      }),
    ];

    // Strip .diff suffix added by handleSelectDiffFile to get original filename
    const realFilename = filename?.replace(/\.diff$/, "");
    const langExt = getLanguageExtension(realFilename);
    if (langExt) extensions.push(langExt);

    if (isDarkMode) {
      extensions.push(darkTheme);
      extensions.push(syntaxHighlighting(darkHighlightStyle));
    } else {
      extensions.push(lightTheme);
      extensions.push(syntaxHighlighting(lightHighlightStyle));
    }

    const state = EditorState.create({
      doc: modified,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [diffText, filename, isDarkMode]);

  return (
    <div ref={containerRef} className={`h-full overflow-auto ${className}`} />
  );
}
