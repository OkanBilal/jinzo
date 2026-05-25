import { useRef, useState, useCallback } from "react";
import {
  Commit,
  PullRequest,
  ArrowUp,
  Branch,
  Refresh,
} from "@/components/ui/icons";
import {
  Button,
  Caption,
  DropdownMenu,
  DropdownMenuItem,
  Text,
  toast,
} from "@/components/ui";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
import {
  useGetLatestWorkspaceDiffSummaryQuery,
  useListWorkspaceActivityQuery,
  useResyncWorkspaceDiffMutation,
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

  const { data: diff } = useGetLatestWorkspaceDiffSummaryQuery(
    activeWorkspaceId!,
    { skip: !activeWorkspaceId },
  );

  const { data: activities = [] } = useListWorkspaceActivityQuery(
    { workspaceId: activeWorkspaceId! },
    { skip: !activeWorkspaceId, pollingInterval: 15000 },
  );

  const [resyncDiff, { isLoading: isResyncing }] =
    useResyncWorkspaceDiffMutation();

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

  const handleRefresh = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!activeWorkspaceId || isResyncing) return;
      try {
        const summary = await resyncDiff(activeWorkspaceId).unwrap();
        const fileCount = summary?.files?.length ?? 0;
        toast.success(
          fileCount === 0
            ? "Working tree clean"
            : `${fileCount} file${fileCount === 1 ? "" : "s"} changes`,
        );
      } catch {
        toast.error("Failed to refresh git state");
      }
    },
    [activeWorkspaceId, isResyncing, resyncDiff],
  );

  if (!activeWorkspaceId) return null;

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-1 px-1.5 py-1.25 rounded-lg cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100/80 dark:hover:bg-primary/10 transition-all duration-300 ease-out"
      >
        <Branch className="size-3.5" />
        <Caption className="text-s">Git</Caption>
        <ArrowUp
          className={`size-3 transition-transform duration-200 rotate-180`}
        />
      </Button>

      <DropdownMenu
        isOpen={isOpen}
        position={position}
        onClose={() => setIsOpen(false)}
        minWidth={160}
        origin="top-right"
      >
        <div className="flex items-center justify-between px-3 py-1.5">
          <Caption>Git actions</Caption>
          <Button
          tooltip="Refresh git state"
            tooltipPosition="top"
            onClick={handleRefresh}
            disabled={isResyncing}
            aria-label="Refresh git state"
            title="Refresh git state"
            className="py-1 rounded-md cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Refresh
              className={`size-3 ${isResyncing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        <DropdownMenuItem onClick={handleCommit} disabled={!hasDiff}>
          <Commit className="size-4" />
          <Text className="text-s">Commit</Text>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCreatePR} disabled={!hasCommit}>
          <PullRequest className="size-4" />
          <Text className="text-s">Create PR</Text>
        </DropdownMenuItem>
      </DropdownMenu>
    </>
  );
}
