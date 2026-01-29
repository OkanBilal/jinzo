import { useState, useEffect } from "react";
import {
  useGetIssuesByWorkspaceQuery,
  type WorkspaceIssue,
} from "@/lib/redux/api";
import { IssueListItem } from "./issue-list-item";
import { ArrowUp } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/text";

interface IssuesSectionProps {
  workspaceId: string | undefined;
  activeIssueEntityId: string | null;
  onSelectIssue: (issue: WorkspaceIssue) => void;
  onAddToContext?: (issue: WorkspaceIssue) => void;
}

function getStorageKey(workspaceId: string | undefined): string {
  return `issues-section-expanded-${workspaceId ?? "none"}`;
}

export function IssuesSection({
  workspaceId,
  activeIssueEntityId,
  onSelectIssue,
  onAddToContext,
}: IssuesSectionProps) {
  const { data: issues = [], isLoading } = useGetIssuesByWorkspaceQuery(
    workspaceId || "",
    { skip: !workspaceId }
  );

  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    return stored !== null ? stored === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(getStorageKey(workspaceId), String(expanded));
  }, [expanded, workspaceId]);

  // Reset expanded state when workspace changes
  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    setExpanded(stored !== null ? stored === "true" : true);
  }, [workspaceId]);

  if (!workspaceId) return null;

  const issueCount = issues.length;

  return (
    <div className="shrink-0 px-3 py-2">
      {/* Header */}
      <Button
        variant="subtle"
        size="xs"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center "
      >
        <ArrowUp
          className={`w-3 h-3 transform text-primary-900 dark:text-primary transition-transform ${expanded ? "rotate-180" : "rotate-90"}`}
        />
        <Caption className="text-primary-900 dark:text-primary-200! font-medium">
          Issues
        </Caption>
        {issueCount > 0 ? (
          <span className="text-[10px] text-primary-400 dark:text-primary-200! ml-auto mr-1 tabular-nums">
            {issueCount}
          </span>
        ) : (
          <div className="ml-auto mr-1" />
        )}
      </Button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="max-h-80 overflow-y-auto px-1 pb-2">
            {" "}
            {/* TODO Make resizable */}
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs shine-text">
                  Loading issues...
                </span>
              </div>
            ) : issueCount === 0 ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs text-primary-400 dark:text-primary-500">
                  No issues for this workspace.
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {issues.map((issue, index) => (
                  <div
                    key={issue.issue.entityId}
                    className="animate-slide-in first:mt-2"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <IssueListItem
                      issue={issue}
                      isActive={activeIssueEntityId === issue.issue.entityId}
                      onClick={() => onSelectIssue(issue)}
                      onAddToContext={onAddToContext ? () => onAddToContext(issue) : undefined}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
