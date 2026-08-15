import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";
import { Tiny } from "@/components/ui";

export interface PRParams {
  title?: string;
  body?: string;
  base?: string;
  draft?: boolean;
  labels?: string[];
}

export function PRDisplay({
  params,
  isCompact = false,
}: {
  params: PRParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasContent = !!params.title || !!params.body;
  const titleText = params.title || "No title";

  return (
    <div>
      <ToolHeader
        icon={<Mains className="size-4" />}
        verb="PR"
        hasDetails={hasContent}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {params.draft && (
          <span className="text-warning text-xs shrink-0">
            draft
          </span>
        )}
        {params.base && (
          <span className="text-primary-500 shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
           {params.base}
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {titleText}
        </span>
      </ToolHeader>

      {hasContent && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="space-y-2">
            {params.labels?.length ? (
              <div className="flex flex-wrap gap-1">
                {params.labels.map((label) => (
                  <span
                    key={label}
                    className="text-xs font-mono text-primary-950 dark:text-primary bg-primary-50 dark:bg-primary/5 rounded px-1.5 py-0.5"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {params.body && (
              <Tiny as="div" className="whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
                {params.body}
              </Tiny>
            )}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
