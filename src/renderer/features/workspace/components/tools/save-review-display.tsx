import { useState } from "react";
import { Mains } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface SaveReviewParams {
  title?: string;
  summary?: string;
  status?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}


export function SaveReviewDisplay({
  params,
  isCompact = false,
}: {
  params: SaveReviewParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSummary = !!params.summary;

  return (
    <div>
      <ToolHeader
        icon={<Mains className="size-3.5" />}
        verb="Saved review"
        hasDetails={hasSummary}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.title || "Untitled review"}
        </span>
      </ToolHeader>

      {hasSummary && (
        <ToolCollapse isExpanded={isExpanded}>
          <p className="text-s text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
            {params.summary}
          </p>
        </ToolCollapse>
      )}
    </div>
  );
}
