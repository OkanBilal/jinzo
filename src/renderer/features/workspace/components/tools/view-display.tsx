import { useState } from "react";
import { ArrowUp, Read } from "@/components/ui/icons";
import { useOpenFileInEditor } from "../../hooks/use-open-file-in-editor";
import { FileIconComponent } from "../file-explorer/components/file-icon";

export interface ViewParams {
  path?: string;
}

export function ViewDisplay({ params, output, isCompact = false }: { params: ViewParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const openFile = useOpenFileInEditor();

  const { content, numLines } = parseViewOutput(output);
  const hasContent = !!content;
  const filePath = params.path ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const fileExt = (() => {
    const dotIdx = fileName.lastIndexOf(".");
    return dotIdx > 0 ? fileName.slice(dotIdx + 1) : undefined;
  })();

  return (
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1  text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Read className="size-3.5 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary">
            Viewed
          </span>
        )}
        {numLines > 0 && (
          <span className="text-primary-500  group-hover:text-primary-950 group-hover:dark:text-primary">
            {numLines} lines
          </span>
        )}
        <span
          role={filePath ? "link" : undefined}
          title={filePath ? "Open in editor" : undefined}
          onClick={(e) => {
            if (!filePath) return;
            e.stopPropagation();
            openFile(filePath);
          }}
          className={`inline-flex items-center gap-1 min-w-0 text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary ${filePath ? "cursor-pointer hover:underline hover:text-primary-950 hover:dark:text-primary" : ""}`}
        >
          {filePath && (
            <FileIconComponent
              extension={fileExt}
              fileName={fileName}
              className="size-3.5 shrink-0"
            />
          )}
          <span className="truncate">{fileName}</span>
        </span>
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <pre className="noscrollbar text-s font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseViewOutput(output: unknown): { content: string | null; numLines: number } {
  if (!output) return { content: null, numLines: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { content: parsed as string, numLines: (parsed as string).split("\n").filter(l => l.length > 0).length };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const content = typeof obj.content === "string" ? obj.content : null;
    const numLines = content ? content.split("\n").filter(l => l.length > 0).length : 0;
    return { content, numLines };
  }

  return { content: null, numLines: 0 };
}
