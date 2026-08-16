import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { TOOL_ROW_TEXT, ToolCollapse, ToolHeader } from "./_shared";
import { Text, Tiny } from "@/components/ui";

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
          <Text as="span" size="xs" tone="warning" className="shrink-0">
            draft
          </Text>
        )}
        {params.base && (
          <span className={`shrink-0 ${TOOL_ROW_TEXT}`}>
           {params.base}
          </span>
        )}
        <span className={`truncate ${TOOL_ROW_TEXT}`}>
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
