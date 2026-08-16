import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { TOOL_ROW_TEXT, ToolCollapse, ToolHeader } from "./_shared";
import { Text, Tiny } from "@/components/ui";
import { shortPath } from "../../lib/path-utils";

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
          <span className={`shrink-0 ${TOOL_ROW_TEXT}`}>
            {params.files.length} file{params.files.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className={`truncate ${TOOL_ROW_TEXT}`}>
          {firstLine}
        </span>
      </ToolHeader>

      {hasContent && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="space-y-2">
            {params.files?.length && (
              <div className="space-y-0.5">
                {params.files.map((file) => (
                  <Text as="div" key={file} size="xs" tone="faint" className="font-mono py-0.5">
                    {shortPath(file)}
                  </Text>
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
