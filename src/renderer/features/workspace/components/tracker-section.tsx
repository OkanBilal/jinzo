import { useState, useEffect, useMemo } from "react";
import {
  useListProjectIssuesQuery,
  useGetSignalsByProjectQuery,
  type ProjectIssue,
  type SignalWithEntity,
} from "@/lib/redux/api";
import { IssueListItem } from "./issue-list-item";
import { SignalListItem } from "./signal-list-item";
import { ArrowUp } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import { BodySmall } from "@/components/ui/text";

type TrackerFilter = "all" | "issues" | "signals";

type TrackerItem =
  | { kind: "issue"; data: ProjectIssue }
  | { kind: "signal"; data: SignalWithEntity };

interface TrackerSectionProps {
  projectId: string | undefined;
  activeIssueEntityId: string | null;
  onSelectIssue: (issue: ProjectIssue) => void;
  onAddIssueToContext?: (issue: ProjectIssue) => void;
  onSelectSignal?: (signal: SignalWithEntity) => void;
  onAddSignalToContext?: (signal: SignalWithEntity) => void;
}

function getStorageKey(projectId: string | undefined): string {
  return `tracker-section-${projectId ?? "none"}`;
}

function loadState(projectId: string | undefined): {
  expanded: boolean;
  filter: TrackerFilter;
} {
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        expanded: parsed.expanded ?? true,
        filter: ["all", "issues", "signals"].includes(parsed.filter)
          ? parsed.filter
          : "all",
      };
    }
  } catch {
    // ignore
  }
  return { expanded: false, filter: "all" };
}

const filters: { value: TrackerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "issues", label: "Issues" },
  { value: "signals", label: "Signals" },
];

export function TrackerSection({
  projectId,
  activeIssueEntityId,
  onSelectIssue,
  onAddIssueToContext,
  onSelectSignal,
  onAddSignalToContext,
}: TrackerSectionProps) {
  const { data: issues = [], isLoading: issuesLoading } =
    useListProjectIssuesQuery(projectId || "", { skip: !projectId });

  const { data: signals = [], isLoading: signalsLoading } =
    useGetSignalsByProjectQuery(projectId || "", { skip: !projectId });

  const [state, setState] = useState(() => {
    const loaded = loadState(projectId);
    return { forProjectId: projectId, ...loaded };
  });

  let { expanded, filter } = state;
  if (projectId !== state.forProjectId) {
    const loaded = loadState(projectId);
    expanded = loaded.expanded;
    filter = loaded.filter;
    setState({ forProjectId: projectId, expanded, filter });
  }

  useEffect(() => {
    localStorage.setItem(
      getStorageKey(projectId),
      JSON.stringify({ expanded, filter })
    );
  }, [expanded, filter, projectId]);

  const items = useMemo<TrackerItem[]>(() => {
    const list: TrackerItem[] = [];
    if (filter !== "signals") {
      for (const issue of issues) list.push({ kind: "issue", data: issue });
    }
    if (filter !== "issues") {
      for (const signal of signals) list.push({ kind: "signal", data: signal });
    }
    return list;
  }, [issues, signals, filter]);

  if (!projectId) return null;

  const isLoading = issuesLoading || signalsLoading;
  const totalCount = issues.length + signals.length;

  return (
    <div className="shrink-0 px-3 pb-2">
      {/* Header */}
      <Button
        variant="subtle"
        size="xs"
        onClick={() =>
          setState((prev) => ({ ...prev, expanded: !prev.expanded }))
        }
        className="w-full flex items-center bg-primary/50 dark:bg-primary/5"
      >
        <ArrowUp
          className={`w-3 h-3 transform text-primary-900 dark:text-primary transition-transform  g ${
            expanded ? "rotate-180" : "rotate-90"
          }`}
        />
        <BodySmall>
          Linked  Resources
        </BodySmall>
        {totalCount > 0 ? (
          <span className="text-t text-primary-800 dark:text-primary-200 ml-auto mr-1 tabular-nums">
            {totalCount}
          </span>
        ) : (
          <div className="ml-auto mr-1" />
        )}
      </Button>

      {/* Expandable content */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {/* Filter pills */}
          <div className="flex items-center gap-1 px-1 pt-1 pb-1.5">
            {filters.map((f) => (
              <Button
                key={f.value}
                onClick={() =>
                  setState((prev) => ({ ...prev, filter: f.value }))
                }
                className={`px-2 py-0.5 text-xxs font-medium rounded-lg transition-colors ${
                  filter === f.value
                    ? "bg-primary/80 dark:bg-primary/10 text-primary-900 dark:text-primary-100"
                    : "text-primary-700 dark:text-primary-300 hover:bg-primary/50 dark:hover:bg-primary/5"
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-84 min-h-20 overflow-y-auto px-1 pb-2 noscrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs shine-text">Loading...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs text-primary-800 dark:text-primary-300">
                  No {filter === "all" ? "items" : filter} for this project.
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {items.map((item, index) => (
                  <div
                    key={
                      item.kind === "issue"
                        ? item.data.issue.entityId
                        : item.data.signal.entityId
                    }
                    className="animate-slide-in first:mt-1"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    {item.kind === "issue" ? (
                      <IssueListItem
                        issue={item.data}
                        isActive={
                          activeIssueEntityId === item.data.issue.entityId
                        }
                        onClick={() => onSelectIssue(item.data)}
                        onAddToContext={
                          onAddIssueToContext
                            ? () => onAddIssueToContext(item.data)
                            : undefined
                        }
                      />
                    ) : (
                      <SignalListItem
                        signal={item.data}
                        isActive={false}
                        onClick={() => onSelectSignal?.(item.data)}
                        onAddToContext={
                          onAddSignalToContext
                            ? () => onAddSignalToContext(item.data)
                            : undefined
                        }
                      />
                    )}
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
