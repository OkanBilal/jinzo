import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";
import { Tiny } from "@/components/ui";
import { shortPath } from "../../utils/path-utils";

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
  const firstLine = params.message?.split("\n")[0] || "No message";

  return (
    <div>
      <ToolHeader
        icon={<Mains className="size-4" />}
        verb="Committed"
        hasDetails={hasContent}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {params.files?.length && (
          <span className="text-primary-500 shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
            {params.files.length} file{params.files.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {firstLine}
        </span>
      </ToolHeader>

      {hasContent && (
        <ToolCollapse isExpanded={isExpanded}>
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
              <Tiny as="div" className="whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
                {params.message}
              </Tiny>
            )}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
