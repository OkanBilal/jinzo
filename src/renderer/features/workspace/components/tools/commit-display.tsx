import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

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
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="size-3.5 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Committed
          </span>
        )}
        {params.files?.length && (
          <span className="text-primary-500 shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
            {params.files.length} file{params.files.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {firstLine}
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
            <div className="space-y-2">
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
                <p className="text-s text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
                  {params.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : fullPath;
}
