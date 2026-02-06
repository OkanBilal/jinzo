import { useRef, useEffect } from "react";
import { EditorState, Extension } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

interface CodeMirrorEditorProps {
  content: string;
  filename?: string;
  className?: string;
}

// Map file extensions to CodeMirror language support
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

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      fontSize: "13px",
      height: "100%",
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: "1.6",
    },
    ".cm-content": {
      padding: "12px 0",
      caretColor: "var(--color-primary-600)",
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--color-primary-600)",
      borderLeftWidth: "2px",
    },
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
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-primary-600)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--color-primary-100)",
    },
    ".cm-line": {
      padding: "0 16px",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--color-primary-200) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-primary-200) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "var(--color-primary-200)",
      outline: "1px solid var(--color-primary-400)",
    },
    ".cm-searchMatch": {
      backgroundColor: "var(--color-amber-200)",
      borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "var(--color-amber-300)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--color-primary-100)",
      border: "1px solid var(--color-primary-300)",
      color: "var(--color-primary-500)",
      borderRadius: "4px",
      padding: "0 4px",
      margin: "0 2px",
    },
  },
  { dark: false },
);

// Light mode syntax highlighting
const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#7c3aed" }, // violet-600
  { tag: tags.controlKeyword, color: "#7c3aed" },
  { tag: tags.moduleKeyword, color: "#7c3aed" },
  { tag: tags.operatorKeyword, color: "#7c3aed" },
  { tag: tags.definitionKeyword, color: "#7c3aed" },
  { tag: tags.operator, color: "#64748b" }, // slate-500
  { tag: tags.separator, color: "#64748b" },
  { tag: tags.punctuation, color: "#64748b" },
  { tag: tags.bracket, color: "#64748b" },
  { tag: tags.angleBracket, color: "#64748b" },
  { tag: tags.squareBracket, color: "#64748b" },
  { tag: tags.paren, color: "#64748b" },
  { tag: tags.brace, color: "#64748b" },
  { tag: tags.string, color: "#059669" }, // emerald-600
  { tag: tags.regexp, color: "#dc2626" }, // red-600
  { tag: tags.escape, color: "#0891b2" }, // cyan-600
  { tag: tags.number, color: "#ea580c" }, // orange-600
  { tag: tags.bool, color: "#ea580c" },
  { tag: tags.null, color: "#ea580c" },
  { tag: tags.atom, color: "#ea580c" },
  { tag: tags.comment, color: "#94a3b8", fontStyle: "italic" }, // slate-400
  { tag: tags.lineComment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.docComment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.variableName, color: "#0f172a" }, // slate-900
  { tag: tags.definition(tags.variableName), color: "#2563eb" }, // blue-600
  { tag: tags.function(tags.variableName), color: "#2563eb" },
  { tag: tags.propertyName, color: "#0891b2" }, // cyan-600
  { tag: tags.definition(tags.propertyName), color: "#0891b2" },
  { tag: tags.typeName, color: "#0d9488" }, // teal-600
  { tag: tags.className, color: "#0d9488" },
  { tag: tags.namespace, color: "#0d9488" },
  { tag: tags.macroName, color: "#7c3aed" },
  { tag: tags.labelName, color: "#7c3aed" },
  { tag: tags.tagName, color: "#dc2626" }, // red-600
  { tag: tags.attributeName, color: "#ea580c" }, // orange-600
  { tag: tags.attributeValue, color: "#059669" },
  { tag: tags.meta, color: "#94a3b8" },
  { tag: tags.heading, color: "#1e293b", fontWeight: "bold" }, // slate-800
  {
    tag: tags.heading1,
    color: "#1e293b",
    fontWeight: "bold",
    fontSize: "1.25em",
  },
  {
    tag: tags.heading2,
    color: "#1e293b",
    fontWeight: "bold",
    fontSize: "1.15em",
  },
  { tag: tags.heading3, color: "#1e293b", fontWeight: "bold" },
  { tag: tags.link, color: "#2563eb", textDecoration: "underline" },
  { tag: tags.url, color: "#2563eb" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.invalid, color: "#dc2626", textDecoration: "wavy underline" },
]);

// ─────────────────────────────────────────────────────────────
// Custom Dark Theme
// ─────────────────────────────────────────────────────────────
const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      fontSize: "13px",
      height: "100%",
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: "1.6",
    },
    ".cm-content": {
      padding: "12px 0",
      caretColor: "var(--color-primary-400)",
      fontFamily:
        "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--color-primary-400)",
      borderLeftWidth: "2px",
    },
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
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-primary-300)",
    },
    ".cm-activeLine": {
      backgroundColor: "#ffff0a0", // primary-100 with 20%
    },
    ".cm-line": {
      padding: "0 16px",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--color-primary-800) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-primary-700) !important",
    },
    ".cm-matchingBracket": {
      backgroundColor: "var(--color-primary-800)",
      outline: "1px solid var(--color-primary-500)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(251, 191, 36, 0.3)", // amber with opacity
      borderRadius: "2px",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(251, 191, 36, 0.5)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--color-primary-800)",
      border: "1px solid var(--color-primary-600)",
      color: "var(--color-primary-400)",
      borderRadius: "4px",
      padding: "0 4px",
      margin: "0 2px",
    },
  },
  { dark: true },
);

// Dark mode syntax highlighting
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c4b5fd" }, // violet-300
  { tag: tags.controlKeyword, color: "#c4b5fd" },
  { tag: tags.moduleKeyword, color: "#c4b5fd" },
  { tag: tags.operatorKeyword, color: "#c4b5fd" },
  { tag: tags.definitionKeyword, color: "#c4b5fd" },
  { tag: tags.operator, color: "#94a3b8" }, // slate-400
  { tag: tags.separator, color: "#94a3b8" },
  { tag: tags.punctuation, color: "#94a3b8" },
  { tag: tags.bracket, color: "#94a3b8" },
  { tag: tags.angleBracket, color: "#94a3b8" },
  { tag: tags.squareBracket, color: "#94a3b8" },
  { tag: tags.paren, color: "#94a3b8" },
  { tag: tags.brace, color: "#94a3b8" },
  { tag: tags.string, color: "#6ee7b7" }, // emerald-300
  { tag: tags.regexp, color: "#fca5a5" }, // red-300
  { tag: tags.escape, color: "#67e8f9" }, // cyan-300
  { tag: tags.number, color: "#fdba74" }, // orange-300
  { tag: tags.bool, color: "#fdba74" },
  { tag: tags.null, color: "#fdba74" },
  { tag: tags.atom, color: "#fdba74" },
  { tag: tags.comment, color: "#64748b", fontStyle: "italic" }, // slate-500
  { tag: tags.lineComment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.blockComment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.docComment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.variableName, color: "#e2e8f0" }, // slate-200
  { tag: tags.definition(tags.variableName), color: "#93c5fd" }, // blue-300
  { tag: tags.function(tags.variableName), color: "#93c5fd" },
  { tag: tags.propertyName, color: "#67e8f9" }, // cyan-300
  { tag: tags.definition(tags.propertyName), color: "#67e8f9" },
  { tag: tags.typeName, color: "#5eead4" }, // teal-300
  { tag: tags.className, color: "#5eead4" },
  { tag: tags.namespace, color: "#5eead4" },
  { tag: tags.macroName, color: "#c4b5fd" },
  { tag: tags.labelName, color: "#c4b5fd" },
  { tag: tags.tagName, color: "#fca5a5" }, // red-300
  { tag: tags.attributeName, color: "#fdba74" }, // orange-300
  { tag: tags.attributeValue, color: "#6ee7b7" },
  { tag: tags.meta, color: "#64748b" },
  { tag: tags.heading, color: "#f1f5f9", fontWeight: "bold" }, // slate-100
  {
    tag: tags.heading1,
    color: "#f1f5f9",
    fontWeight: "bold",
    fontSize: "1.25em",
  },
  {
    tag: tags.heading2,
    color: "#f1f5f9",
    fontWeight: "bold",
    fontSize: "1.15em",
  },
  { tag: tags.heading3, color: "#f1f5f9", fontWeight: "bold" },
  { tag: tags.link, color: "#93c5fd", textDecoration: "underline" },
  { tag: tags.url, color: "#93c5fd" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.invalid, color: "#fca5a5", textDecoration: "wavy underline" },
]);

export function CodeMirrorEditor({
  content,
  filename,
  className = "",
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Detect dark mode
  const isDarkMode = document.documentElement.classList.contains("dark");

  useEffect(() => {
    if (!containerRef.current) return;

    // Build extensions array
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ];

    // Add language extension if available
    const langExt = getLanguageExtension(filename);
    if (langExt) {
      extensions.push(langExt);
    }

    // Add theme based on dark mode
    if (isDarkMode) {
      extensions.push(darkTheme);
      extensions.push(syntaxHighlighting(darkHighlightStyle));
    } else {
      extensions.push(lightTheme);
      extensions.push(syntaxHighlighting(lightHighlightStyle));
    }

    // Create editor state
    const state = EditorState.create({
      doc: content,
      extensions,
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [content, filename, isDarkMode]);

  return (
    <div ref={containerRef} className={`h-full overflow-auto ${className}`} />
  );
}
