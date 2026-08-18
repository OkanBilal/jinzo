import type { ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { setWorkspaceGroupExpanded } from "@/lib/redux/slices/appSettingsSlice";
import { Button, Text } from "@/components/ui";
import { ArrowUp, New } from "@/components/ui/icons";

/**
 * A collapsible sidebar section: header row (label, count, hover "+" action)
 * over an animated children well. Extracted from the workspace list so the
 * chat list's "Projects" tree can share it — it is agnostic about what the
 * children are. Expand state persists per `groupKey` in appSettings.
 */
export function SidebarGroupSection({
  groupKey,
  label,
  icon,
  count,
  action,
  secondaryAction,
  children,
}: {
  groupKey: string;
  label: string;
  icon?: ReactNode;
  count: number;
  /** Hover-revealed "+" on the header (e.g. "Create new worktree", "New chat"). */
  action?: { label: string; onClick: () => void };
  /** Optional sibling action rendered before the primary "+" action. */
  secondaryAction?: { label: string; onClick: () => void; icon: ReactNode };
  children: ReactNode;
}) {
  const dispatch = useAppDispatch();
  // Absent means expanded — a group the user has never touched starts open.
  const expanded = useAppSelector(
    (state) => state.appSettings.workspaceGroupExpanded[groupKey] ?? true,
  );
  const toggleExpanded = () => {
    dispatch(setWorkspaceGroupExpanded({ groupKey, expanded: !expanded }));
  };

  return (
    <div className="">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className="group/section w-full flex items-center gap-1.5 px-2 py-1 mb-px rounded-lg cursor-pointer hover:bg-primary/50 dark:hover:bg-primary/5 transition-colors"
      >
        {icon && <span className="shrink-0 text-xs">{icon}</span>}
        <Text as="span" size="s" tone="contrast" className="truncate">
          {label}
        </Text>
        <div className="ml-auto flex items-center gap-1.5">
          <Text
            as="span"
            size="xxs"
            tone="secondary"
            className="tabular-nums group-hover/section:hidden"
          >
            {count}
          </Text>
          {action && (
            <>
              {secondaryAction && (
                <Button
                  tooltip={secondaryAction.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    secondaryAction.onClick();
                  }}
                  className="hidden group-hover/section:flex items-center p-0.5 cursor-pointer rounded-md"
                  aria-label={secondaryAction.label}
                >
                  {secondaryAction.icon}
                </Button>
              )}
              <Button
                tooltip={action.label}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="hidden group-hover/section:flex items-center p-0.5 cursor-pointer rounded-md"
                aria-label={action.label}
              >
                <New className="w-3 h-3 text-primary-800 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-100" />
              </Button>
            </>
          )}
          <ArrowUp
            className={`w-3 h-3 -mr-1 text-primary-800 dark:text-primary-200 transition-transform duration-200 hidden group-hover/section:block ${
              expanded ? "rotate-180" : "rotate-90"
            }`}
          />
        </div>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
