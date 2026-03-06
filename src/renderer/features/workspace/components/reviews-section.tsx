import { useState } from "react";
import { useDispatch } from "react-redux";
import {
  useGetWorkspaceActivityQuery,
  useGetAppSettingsQuery,
  useGetWorkspaceByIdQuery,
  useGetProjectByIdQuery,
} from "@/lib/redux/api";
import type { WorkspaceActivity } from "@/lib/redux/api";
import { openNoteTab, setPendingGoal } from "@/lib/redux/slices/workspaceSlice";
import { Note, PullRequest, Diff, Commit, CircleDot, ArrowUp } from "@/components/ui/icons";
import { Button, Body } from "@/components/ui";
import { formatDate } from "@/lib/format-date";

interface ReviewsSectionProps {
  workspaceId: string;
}

function ActivityIcon({ type }: { type: WorkspaceActivity["type"] }) {
  switch (type) {
    case "diff":
      return <Diff className="size-4 text-primary-700 dark:text-primary-300  shrink-0" />;
    case "review":
      return <Note className="size-4 text-primary-700 dark:text-primary-300 shrink-0" />;
    case "finding":
      return <CircleDot className="size-4 text-primary-700 dark:text-primary-300  shrink-0" />;
    case "commit":
      return <Commit className="size-5 text-primary-700 dark:text-primary-300  shrink-0" />;
    case "pr":
      return <PullRequest className="size-4 text-primary-700 dark:text-primary-300  shrink-0" />;
  }
}

function activityDetail(activity: WorkspaceActivity): string | null {
  const meta = activity.metadata as any;
  switch (activity.type) {
    case "diff":
      return activity.summary || null;
    case "finding": {
      if (meta?.count) {
        const parts: string[] = [];
        if (meta.critical) parts.push(`${meta.critical} critical`);
        if (meta.warning) parts.push(`${meta.warning} warning`);
        if (meta.info) parts.push(`${meta.info} info`);
        return parts.length > 0 ? parts.join(", ") : null;
      }
      return meta?.severity ?? null;
    }
    case "commit":
      return activity.title;
    default:
      return null;
  }
}

export function ReviewsSection({ workspaceId }: ReviewsSectionProps) {
  const dispatch = useDispatch();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { data: appSettings } = useGetAppSettingsQuery();
  const { data: workspace } = useGetWorkspaceByIdQuery(workspaceId, {
    skip: !workspaceId,
  });
  const projectId = workspace?.projectId;
  const { data: project } = useGetProjectByIdQuery(projectId ?? "", {
    skip: !projectId,
  });
  const { data: activities = [], isLoading } = useGetWorkspaceActivityQuery(
    { workspaceId },
    { pollingInterval: 5000 },
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-primary-700 dark:text-primary-500">Loading...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Note className="w-4 h-4 dark:text-primary-300 text-primary-700" />
          <Body className="text-xxs font-medium text-primary-700! dark:text-primary-300!">
            No activity yet.
          </Body>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-3">
      {/* Create PR button */}
      <Button
        onClick={() => {
          const instructions =
            project?.prInstructions || appSettings?.prInstructions;
          dispatch(
            setPendingGoal(
              instructions
                ? instructions + "\n\nCreate a pull request."
                : "Create a pull request.",
            ),
          );
        }}
        className="shrink-0 flex items-center justify-center gap-1.5 mb-2 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100/60 dark:bg-primary/5 hover:bg-primary-100 dark:hover:bg-primary/10 text-primary-900 dark:text-primary-200"
      >
        <PullRequest className="w-3.5 h-3.5" />
        Create PR
      </Button>

      {/* Activity timeline */}
      <div className="flex-1 overflow-y-auto noscrollbar">
        {activities.map((activity, index) => {
          const isLast = index === activities.length - 1;
          const detail = activityDetail(activity);
          const isClickable = activity.type === "review" && !!activity.refId;
          const isExpanded = expandedIds.has(activity.id);

          return (
            <div
              key={activity.id}
              className="flex items-stretch animate-slide-in "
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              {/* Icon column with connecting line */}
              <div className="flex flex-col items-center shrink-0 w-6">
                <div className="flex items-center justify-center size-6">
                  <ActivityIcon type={activity.type} />
                </div>
                {!isLast && (
                  <div className="flex-1 w-px bg-primary-700/30 dark:bg-primary/10 min-h-2" />
                )}
              </div>

              {/* Content */}
              <button
                onClick={() => {
                  if (isClickable) {
                    dispatch(
                      openNoteTab({
                        id: activity.refId!,
                        title: activity.title,
                        status: (activity.metadata as any)?.status ?? "open",
                      }),
                    );
                  } else if (detail) {
                    toggleExpand(activity.id);
                  }
                }}
                className={`flex-1 min-w-0 flex items-start pl-2 pb-3 ${
                  isClickable || detail
                    ? "cursor-pointer hover:opacity-80"
                    : "cursor-default"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-s text-primary-900 dark:text-primary-200 truncate max-w-full text-left block">
                    {activity.type === "commit" ? (
                      <>
                        You committed changes
                        {activity.refId && (
                          <span className="ml-1 text-primary-600 dark:text-primary-400 font-mono text-xxs">
                            {activity.refId.slice(0, 7)}
                          </span>
                        )}
                      </>
                    ) : activity.type === "finding" && (activity.metadata as any)?.count ? (
                      <>Jinzo added {(activity.metadata as any).count} finding{(activity.metadata as any).count === 1 ? "" : "s"}</>
                    ) : (
                      activity.title
                    )}
                    <span className="text-primary-700 dark:text-primary-400 text-xxs font-normal">
                      {" "}&middot; {formatDate(activity.createdAt)}
                    </span>
                  </span>
                  {detail && (
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <span className="text-t text-primary-700 dark:text-primary-400 text-left block mt-1 whitespace-pre-wrap">
                          {detail}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {detail && (
                  <ArrowUp
                    className={`shrink-0 size-3 mt-1 text-primary-700 dark:text-primary-300 transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : "rotate-90"
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
