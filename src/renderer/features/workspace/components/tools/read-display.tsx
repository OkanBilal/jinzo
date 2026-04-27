import { useState } from "react";
import { ArrowUp, Read } from "@/components/ui/icons";

export interface ReadParams {
  // Claude params
  file_path?: string;
  offset?: number;
  limit?: number;
  // Copilot params
  path?: string;
}

export function ReadDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: ReadParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { content, numLines } = parseReadOutput(output);
  const hasContent = !!content;

  return (
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && (
          <Read className="size-3.5 shrink-0 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />
        )}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Read
          </span>
        )}
        <code className="text-primary-500 font-sans truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {shortPath(
            params.file_path ||
              params.path ||
              ((params as any)._title &&
              ((params as any)._title.includes("/") ||
                (params as any)._title.includes("."))
                ? (params as any)._title
                : "") ||
              "",
          )}
        </code>
        {numLines > 0 && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            ({numLines} lines)
          </span>
        )}
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500  opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div
          className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <pre className="noscrollbar text-xs font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseReadOutput(output: unknown): {
  content: string | null;
  numLines: number;
} {
  if (!output) return { content: null, numLines: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {
        content: parsed as string,
        numLines: (parsed as string).split("\n").length,
      };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;

    // Handle { file: { content, numLines, ... } } structure
    if (typeof obj.file === "object" && obj.file !== null) {
      const file = obj.file as Record<string, unknown>;
      const content = typeof file.content === "string" ? file.content : null;
      const numLines = typeof file.numLines === "number" ? file.numLines : 0;
      return { content, numLines };
    }

    // Fallback: direct content/numLines (Copilot uses this format)
    const content = typeof obj.content === "string" ? obj.content : null;
    const numLines =
      typeof obj.numLines === "number"
        ? obj.numLines
        : content
          ? content.split("\n").filter((l) => l.length > 0).length
          : 0;
    return { content, numLines };
  }

  return { content: null, numLines: 0 };
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? "" + parts.slice(-1).join("/") : fullPath;
}
