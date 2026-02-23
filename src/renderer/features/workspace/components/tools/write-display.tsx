import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";

export interface WriteParams {
  file_path?: string;
  content?: string;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "React TSX",
    js: "JavaScript",
    jsx: "React JSX",
    py: "Python",
    rs: "Rust",
    go: "Go",
    rb: "Ruby",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    c: "C",
    cpp: "C++",
    h: "C Header",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    sql: "SQL",
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    toml: "TOML",
    xml: "XML",
    svg: "SVG",
    vue: "Vue",
    svelte: "Svelte",
  };
  return map[ext] ?? ext.toUpperCase();
}

export function WriteDisplay({ params }: { params: WriteParams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const filePath = params.file_path ?? "";
  const content = params.content ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const lineCount = content ? content.split("\n").length : 0;
  const language = filePath ? getLanguageFromPath(filePath) : "";

  const dirPath = useMemo(() => {
    if (!filePath) return "";
    const parts = filePath.split("/");
    if (parts.length <= 1) return "";
    // Show last 3 directory segments max
    const dirParts = parts.slice(0, -1);
    if (dirParts.length > 3) {
      return "…/" + dirParts.slice(-3).join("/");
    }
    return dirParts.join("/");
  }, [filePath]);

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <Edit className="size-4 dark:text-primary-300 text-primary-700" />
        <span className="dark:text-primary-300 text-primary-700 font-medium">
          Write
        </span>
        <span className="text-primary-700 dark:text-primary-200 font-medium truncate">
          {fileName}
        </span>
        <span className="text-primary-500 text-xs shrink-0">
          {lineCount > 0 ? `${lineCount} lines` : ""}
          {language ? ` · ${language}` : ""}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {dirPath && (
            <div className="text-xs text-primary-500 dark:text-primary-400 font-mono truncate px-1">
              {dirPath}
            </div>
          )}
          {content && (
            <pre className="noscrollbar text-xs leading-relaxed text-primary-700 dark:text-primary-300 font-mono whitespace-pre-wrap bg-primary-100/50 dark:bg-primary-900/50 rounded-xl p-3 max-h-80 overflow-y-auto">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
