import { useState } from "react";
import { ArrowUp, Jinzo } from "@/components/ui/icons";

export interface CommitParams {
  message?: string;
  files?: string[];
}

export function CommitDisplay({
  params,
  isCompact = false,
}: {
  params: CommitParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasContent = !!params.message || !!params.files?.length;

  // First line of commit message for the header
  const firstLine = params.message?.split("\n")[0] || "No message";

  return (
    <div className="px-2">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasContent && (
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Jinzo className="w-2 h-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Commit
          </span>
        )}
        {params.files?.length && (
          <span className="text-primary-400 dark:text-primary-500 shrink-0">
            {params.files.length} file{params.files.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="text-primary-500 truncate">
          {firstLine}
        </span>
      </button>

      {isExpanded && hasContent && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3 space-y-2">
                    {params.files?.length && (
            <div className="space-y-0.5">
              {params.files.map((file) => (
                <div key={file} className="text-xs font-mono text-primary-500 py-0.5">
                  {shortPath(file)}
                </div>
              ))}
            </div>
          )}
          {params.message && (
            <p className="text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2">
              {params.message}
            </p>
          )}

        </div>
      )}
    </div>
  );
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : fullPath;
}
