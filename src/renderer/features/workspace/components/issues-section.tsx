import { useState, useEffect } from "react";
import {
  useListProjectIssuesQuery,
  type ProjectIssue,
} from "@/lib/redux/api";
import { IssueListItem } from "./issue-list-item";
import { ArrowUp } from "@/components/ui/icons";
import { Button, Caption } from "@/components/ui";

interface IssuesSectionProps {
  projectId: string | undefined;
  activeIssueEntityId: string | null;
  onSelectIssue: (issue: ProjectIssue) => void;
  onAddToContext?: (issue: ProjectIssue) => void;
}

function getStorageKey(projectId: string | undefined): string {
  return `issues-section-expanded-${projectId ?? "none"}`;
}

export function IssuesSection({
  projectId,
  activeIssueEntityId,
  onSelectIssue,
  onAddToContext,
}: IssuesSectionProps) {
  const { data: issues = [], isLoading } = useListProjectIssuesQuery(
    projectId || "",
    { skip: !projectId }
  );

  const [expandedState, setExpandedState] = useState(() => {
    const stored = localStorage.getItem(getStorageKey(projectId));
    return {
      forProjectId: projectId,
      expanded: stored !== null ? stored === "true" : true,
    };
  });

  let { expanded } = expandedState;
  if (projectId !== expandedState.forProjectId) {
    const stored = localStorage.getItem(getStorageKey(projectId));
    expanded = stored !== null ? stored === "true" : true;
    setExpandedState({ forProjectId: projectId, expanded });
  }

  useEffect(() => {
    localStorage.setItem(getStorageKey(projectId), String(expanded));
  }, [expanded, projectId]);

  if (!projectId) return null;

  const issueCount = issues.length;

  return (
    <div className="shrink-0 px-3">
      {/* Header */}
      <Button
        variant="subtle"
        size="xs"
        onClick={() => setExpandedState((prev) => ({ ...prev, expanded: !prev.expanded }))}
        className="w-full flex items-center "
      >
        <ArrowUp
          className={`w-3 h-3 transform text-primary-900 dark:text-primary transition-transform ${expanded ? "rotate-180" : "rotate-90"}`}
        />
        <Caption className="text-primary-900 dark:text-primary-200 font-medium">
          Issues
        </Caption>
        {issueCount > 0 ? (
          <span className="text-t text-primary-800 dark:text-primary-200 ml-auto mr-1 tabular-nums">
            {issueCount}
          </span>
        ) : (
          <div className="ml-auto mr-1" />
        )}
      </Button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out  ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden ">
          <div className="max-h-84 overflow-y-auto px-1 pb-2 noscrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs shine-text">
                  Loading issues...
                </span>
              </div>
            ) : issueCount === 0 ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs text-primary-800 dark:text-primary-300">
                  No issues for this project.
                </span>
              </div>
            ) : (
              <div className="space-y-0.5 ">
                {issues.map((issue, index) => (
                  <div
                    key={issue.issue.entityId}
                    className="animate-slide-in first:mt-2 "
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
