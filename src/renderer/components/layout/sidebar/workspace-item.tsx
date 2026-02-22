import { useState, useRef, type MouseEvent, type ReactNode } from "react";
import { Muted } from "@/components/ui/text";
import {
  Trash,
  Option,
  Connect,
  Branch,
  Archive,
  Settings,
  External,
  Bash,
} from "@/components/ui/icons";
import { useGetInstalledAppsQuery } from "@/lib/redux/api";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format-date";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSub } from "@/components/ui/dropdown-menu";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import WorkspaceStatusIcon from "@/components/ui/icons/workspace-status-icon";
import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";
import Tooltip from "@/components/ui/tooltip";

type GroupingMode = "none" | "status" | "project";

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
}: WorkspaceItemProps) {
  const { data: installedApps = [] } = useGetInstalledAppsQuery();
  const statusConfig = getWorkspaceStatusConfig(status);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOptionClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        x: Math.min(rect.left + 12, window.innerWidth - 150),
        y: rect.bottom - 2,
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

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        className={`block px-2.5 py-1.5 active:scale-99 group-hover:scale-[1.01] 
          rounded-xl transition-all duration-200 ease-out cursor-pointer ${
          isActive
            ? "bg-primary/80 dark:bg-primary/5"
            : "bg-transparent hover:bg-primary/40 dark:hover:bg-primary/5"
        }`}
      >
        <div className="flex flex-col ">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {grouping !== "project" && (
              <span className="shrink-0 ">
                {projectIcon ?? <Branch className="size-3.5 text-primary-800 dark:text-primary-400" />}
              </span>
            )}
            <span
              className={`truncate text-sm font-medium ${
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
                <span title={statusConfig.label} className="shrink-0 flex items-center">
                  <WorkspaceStatusIcon
                    status={status}
                    className={`size-2.75 ${statusConfig.iconColor}`}
                  />
                </span>
                </Tooltip>
              ) : <span className="size-2.75 mr-2 flex items-center"/>}
              {branch && (
                <Muted className="text-[13px]  text-primary-900 dark:text-primary-200! truncate">
                  {branch}
                </Muted>
              )}
              {branch && updatedAt && (
                <span className="text-primary-900 text-lg leading-6 dark:text-primary-200">
                  ·
                </span>
              )}
              {updatedAt && (
                <Muted className="text-[13px] text-primary-900! dark:text-primary-200! truncate">
                  {formatDate(new Date(updatedAt).toISOString())}
                </Muted>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Options button */}
      <Button
        tooltip="More options"
        ref={buttonRef}
        onClick={handleOptionClick}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer rounded-md z-10"
        aria-label="Workspace options"
      >
        <Option className="w-5 h-5 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200" />
      </Button>

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
                <Bash className="size-4" />
                <span>Open in</span>
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
        {projectId && (
          <DropdownMenuItem onClick={handleSettingsClick}>
            <Settings className="size-4" />
            <span>Project settings</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleLinkIssuesClick}>
          <Connect className="size-4" />
          <span>Connect issues</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleArchiveClick}>
          <Archive className="size-4" />
          <span>Archive</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDeleteClick} variant="danger">
          <Trash className="size-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </div>
  );
}
