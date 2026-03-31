import { useState, useRef, useEffect, type MouseEvent, type ReactNode } from "react";
import { Muted, Button, DropdownMenu, DropdownMenuItem, DropdownMenuSub, Tooltip } from "@/components/ui";
import {
  Trash,
  Option,
  Connect,
  Branch,
  Archive,
  Settings,
  External,
  OpenWith,
  Edit,
} from "@/components/ui/icons";
import { useGetInstalledAppsQuery } from "@/lib/redux/api";
import { useGetLatestWorkspaceDiffQuery } from "@/lib/redux/api/workspaceDiffsApi";
import { formatDate } from "@/lib/format-date";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import WorkspaceStatusIcon from "@/components/ui/icons/workspace-status-icon";
import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";

type GroupingMode = "none" | "status" | "project";

const STATUS_ORDER: WorkspaceStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
  "duplicate",
];

interface WorkspaceItemProps {
  id: string;
  name: string;
  rootPath?: string;
  status?: WorkspaceStatus;
  branch?: string | null;
  updatedAt?: Date;
  isActive?: boolean;
  projectId?: string | null;
  projectIcon?: ReactNode;
  grouping?: GroupingMode;
  onClick?: () => void;
  onDelete?: (e: MouseEvent) => void;
  onLinkIssues?: () => void;
  onArchive?: () => void;
  onSettings?: () => void;
  onStatusChange?: (status: WorkspaceStatus) => void;
  onRenameBranch?: (newBranchName: string) => void;
}

export default function WorkspaceItem({
  id,
  name,
  rootPath,
  status = "todo",
  branch,
  updatedAt,
  isActive = false,
  projectId,
  projectIcon,
  grouping = "none",
  onClick,
  onDelete,
  onLinkIssues,
  onArchive,
  onSettings,
  onStatusChange,
  onRenameBranch,
}: WorkspaceItemProps) {
  const { data: installedApps = [] } = useGetInstalledAppsQuery();
  const { data: latestDiff } = useGetLatestWorkspaceDiffQuery(id);
  const statusConfig = getWorkspaceStatusConfig(status);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const [isRenamingBranch, setIsRenamingBranch] = useState(false);
  const [renameBranchValue, setRenameBranchValue] = useState(branch || "");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const insertions = latestDiff?.stats?.shortstat.match(/(\d+) insertion/)?.[1];
  const deletions = latestDiff?.stats?.shortstat.match(/(\d+) deletion/)?.[1];

  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOptionClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        x: Math.min(rect.left + 32, window.innerWidth - 150),
        y: rect.bottom - 20,
      });
    }

    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDeleteClick = () => {
    setIsDropdownOpen(false);
    onDelete?.(undefined as unknown as MouseEvent);
  };

  const handleLinkIssuesClick = () => {
    setIsDropdownOpen(false);
    onLinkIssues?.();
  };

  const handleArchiveClick = () => {
    setIsDropdownOpen(false);
    onArchive?.();
  };

  const handleSettingsClick = () => {
    setIsDropdownOpen(false);
    onSettings?.();
  };

  const handleRenameBranchClick = () => {
    setIsDropdownOpen(false);
    setRenameBranchValue(branch || "");
    setIsRenamingBranch(true);
  };

  const handleRenameBranchConfirm = () => {
    const trimmed = renameBranchValue.trim();
    if (trimmed && trimmed !== branch) {
      onRenameBranch?.(trimmed);
    }
    setIsRenamingBranch(false);
  };

  const handleRenameBranchCancel = () => {
    setIsRenamingBranch(false);
    setRenameBranchValue(branch || "");
  };

  useEffect(() => {
    if (isRenamingBranch && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamingBranch]);

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={`block px-2.5 py-1.5 active:scale-99 group-hover:scale-[1.01]
          rounded-xl transition-all duration-200 ease-out cursor-pointer ${
            isActive
              ? "bg-primary/80 dark:bg-primary/5"
              : "bg-transparent group-hover:bg-primary/40 dark:group-hover:bg-primary/5"
          }`}
      >
        <div className="flex flex-col ">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {grouping !== "project" && (
              <span className="shrink-0 ">
                {projectIcon ?? (
                  <Branch className="size-3.5 text-primary-800 dark:text-primary-400" />
                )}
              </span>
            )}
            <span
              className={`truncate text-s font-medium ${
                isActive
                  ? "text-primary-950 dark:text-primary"
                  : "text-primary-900 dark:text-primary-100"
              }`}
            >
              {name}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              {grouping !== "status" ? (
                <Tooltip content={statusConfig.label} position="top-right">
                  <span
                    title={statusConfig.label}
                    className="shrink-0 flex items-center"
                  >
                    <WorkspaceStatusIcon
                      status={status}
                      className={`size-2.75 ml-0.5 ${statusConfig.iconColor}`}
                    />
                  </span>
                </Tooltip>
              ) : (
                <span className="size-2.75 mr-2 flex items-center" />
              )}
              {branch && !isRenamingBranch && (
                <Muted className="text-xs  text-primary-900 dark:text-primary-200 truncate">
                  {branch}
                </Muted>
              )}
              {isRenamingBranch && (
                <input
                  ref={renameInputRef}
                  value={renameBranchValue}
                  onChange={(e) => setRenameBranchValue(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleRenameBranchConfirm();
                    if (e.key === "Escape") handleRenameBranchCancel();
                  }}
                  onBlur={handleRenameBranchConfirm}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs bg-primary/20 dark:bg-primary/10 text-primary-900 dark:text-primary-200 rounded px-1 py-0.5 outline-none border border-primary/30 dark:border-primary/20 w-full max-w-35"
                />
              )}
              {branch && updatedAt && (
                <span className="text-primary-900 text-lg leading-6 dark:text-primary-200">
                  ·
                </span>
              )}
              {updatedAt && (
                <Muted className="text-xs text-primary-900 dark:text-primary-200 truncate">
                  {formatDate(new Date(updatedAt).toISOString())}
                </Muted>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diff stats (visible by default, hidden on hover) / Options button (hidden by default, visible on hover) */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-(--z-base)">
        {(insertions || deletions) && (
          <span className="flex items-center gap-1 text-xxs font-mono group-hover:opacity-0 transition-opacity pointer-events-none">
            {insertions && (
              <span className="text-green-600 dark:text-green-400">
                +{insertions}
              </span>
            )}
            {deletions && (
              <span className="text-red-500 dark:text-red-400">
                -{deletions}
              </span>
            )}
          </span>
        )}
        <Button
          tooltip="More options"
          ref={buttonRef}
          onClick={handleOptionClick}
          className={`absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded-md`}
          aria-label="Workspace options"
        >
          <Option className="w-5 h-5 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
        </Button>
      </div>

      {/* Dropdown Menu */}
      <DropdownMenu
        isOpen={isDropdownOpen}
        position={dropdownPosition}
        onClose={() => setIsDropdownOpen(false)}
      >
        {rootPath && installedApps.length > 0 && (
          <DropdownMenuSub
            label={
              <>
                <OpenWith className="size-3.5" />
                <span>Open with</span>
              </>
            }
          >
            {installedApps.map((detectedApp) => (
              <DropdownMenuItem
                key={detectedApp.id}
                onClick={() => {
                  setIsDropdownOpen(false);
                  if (detectedApp.id === "finder") {
                    window.api.shell.openPath(rootPath);
                  } else {
                    window.api.shell.openInApp(detectedApp.id, rootPath);
                  }
                }}
              >
                {detectedApp.icon ? (
                  <img
                    src={detectedApp.icon}
                    alt=""
                    draggable={false}
                    className="size-4 shrink-0 rounded-sm"
                  />
                ) : (
                  <External className="size-4 shrink-0" />
                )}
                <span>{detectedApp.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSub>
        )}
        <DropdownMenuSub
          label={
            <>
              <WorkspaceStatusIcon
                status={status}
                className={`size-3.25 ${statusConfig.iconColor}`}
              />
              <span>Status</span>
            </>
          }
        >
          {STATUS_ORDER.map((s) => {
            const config = getWorkspaceStatusConfig(s);
            return (
              <DropdownMenuItem
                key={s}
                onClick={() => {
                  setIsDropdownOpen(false);
                  onStatusChange?.(s);
                }}
                className={
                  s === status ? "bg-primary-950/10 dark:bg-primary/10" : ""
                }
              >
                <WorkspaceStatusIcon
                  status={s}
                  className={`size-3.5 ${config.iconColor}`}
                />
                <span>{config.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSub>
        {projectId && (
          <DropdownMenuItem onClick={handleSettingsClick}>
            <Settings className="size-3.5" />
            <span>Project settings</span>
          </DropdownMenuItem>
        )}
        {branch && onRenameBranch && (
          <DropdownMenuItem onClick={handleRenameBranchClick}>
            <Edit className="size-3.5" />
            <span>Rename branch</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLinkIssuesClick}>
          <Connect className="size-3.5" />
          <span>Link resources</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleArchiveClick}>
          <Archive className="size-3.5" />
          <span>Archive</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDeleteClick} variant="danger">
          <Trash className="size-3.5" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
