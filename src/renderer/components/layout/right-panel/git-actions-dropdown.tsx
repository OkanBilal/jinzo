import { useRef, useState, useCallback } from "react";
import { Commit, PullRequest, ArrowUp, Branch } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
import {
  useGetLatestWorkspaceDiffQuery,
  useGetWorkspaceActivityQuery,
} from "@/lib/redux/api";
import {
  setPendingGoal,
  setPendingAutoExecute,
} from "@/lib/redux/slices/workspaceSlice";

export function GitActionsDropdown() {
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const { data: diff } = useGetLatestWorkspaceDiffQuery(activeWorkspaceId!, {
    skip: !activeWorkspaceId,
  });

  const { data: activities = [] } = useGetWorkspaceActivityQuery(
    { workspaceId: activeWorkspaceId! },
    { skip: !activeWorkspaceId, pollingInterval: 5000 },
  );

  const hasDiff = Boolean(diff?.files?.length);
  const hasCommit = activities.some((a) => a.type === "commit");

  const handleToggle = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ x: rect.right - 160, y: rect.bottom + 4 });
    setIsOpen((v) => !v);
  }, []);

  const handleCommit = useCallback(() => {
    dispatch(setPendingGoal("Commit changes in this workspace."));
    dispatch(setPendingAutoExecute(true));
    setIsOpen(false);
  }, [dispatch]);

  const handleCreatePR = useCallback(() => {
    dispatch(setPendingGoal("Create a pull request."));
    dispatch(setPendingAutoExecute(true));
    setIsOpen(false);
  }, [dispatch]);

  if (!activeWorkspaceId) return null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-1 px-1.5 py-1.25 rounded-lg cursor-pointer text-primary-700 dark:text-primary-500 hover:bg-primary-100/80 dark:hover:bg-primary/10 transition-all duration-300 ease-out"
      >
        <Branch className="size-3.5" />
        <span className="text-xs font-medium">Git</span>
        <ArrowUp
          className={`size-3 transition-transform duration-200 rotate-180`}
        />
      </button>

      <DropdownMenu
        isOpen={isOpen}
        position={position}
        onClose={() => setIsOpen(false)}
        minWidth={160}
        origin="top-right"
      >
        <div className="px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-500">
          Git actions
        </div>
        <DropdownMenuItem onClick={handleCommit} disabled={!hasDiff}>
          <Commit className="size-4" />
          <span>Commit</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCreatePR} disabled={!hasCommit}>
          <PullRequest className="size-4" />
          <span>Create PR</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </>
  );
}
