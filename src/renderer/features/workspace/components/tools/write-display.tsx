import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";

export interface WriteParams {
  file_path?: string;
  content?: string;
}


export function WriteDisplay({ params }: { params: WriteParams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const filePath = params.file_path ?? "";
  const content = params.content ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const lineCount = content ? content.split("\n").length : 0;

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
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
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
        {lineCount > 0 && (
          <span className="text-green-600 dark:text-green-400 text-xs shrink-0">
            +{lineCount}
          </span>
        )}

      </button>

      {isExpanded && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {dirPath && (
            <div className="text-xs text-primary-500 dark:text-primary-400 font-mono truncate px-1">
              {dirPath}
            </div>
          )}
          {content && (
            <div className="noscrollbar text-xs leading-relaxed font-mono bg-primary-50 dark:bg-primary/5 rounded-xl p-3 max-h-80 overflow-y-auto">
              {content.split("\n").map((line, lineNum) => (
                <div key={lineNum} className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30">
                  +{line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
