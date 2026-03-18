import { Archive, CopilotStatic, Option, Edit } from "@/components/ui/icons";
import type { Run } from "../types";
import { Claude } from "@/components/ui/icons/space";
import { AnimatedTitle } from "@/components/ui";
import { BaseTab } from "./base-tab";
import { AsciiSpinner } from "./ascii-loader";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui";
import { useState, useRef, useCallback, useEffect } from "react";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  onClose: () => void;
  onRename: (newTitle: string) => void;
  title: string;
  variant?: "copilot" | "claude";
}

function VariantIcon({ variant, isActive }: { variant: string; isActive: boolean }) {
  const className = `size-4 ${
    isActive
      ? "text-primary-900 dark:text-primary-200"
      : "text-primary-900 dark:text-primary-200 group-hover:text-primary-900 dark:group-hover:text-primary-200"
  }`;

  if (variant === "claude") return <Claude className="text-claude" />;
  if (variant === "copilot") return <CopilotStatic className={className} />;
  return null;
}

function TabIcon({ run, variant, isActive }: { run: Run; variant: string; isActive: boolean }) {
  const isRunning = run.status === "running" || run.status === "queued";
  return (
    <span className="flex items-center justify-center size-3.5 shrink-0">
      {isRunning ? (
        <AsciiSpinner variant={variant as "claude" | "copilot"} />
      ) : (
        <VariantIcon variant={variant} isActive={isActive} />
      )}
    </span>
  );
}

export function RunTab({ run, isActive, isFirst, onClick, onClose, onRename, title, variant = "copilot" }: RunTabProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleOptionsClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const el = (e.target as HTMLElement).closest("button") ?? (e.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    setDropdownPosition({
      x: rect.left,
      y: rect.bottom + 4,
    });
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const handleRenameStart = useCallback(() => {
    setRenameValue(title);
    setIsRenaming(true);
    setIsDropdownOpen(false);
  }, [title]);

  const handleRenameConfirm = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, title, onRename]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleRenameConfirm();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
    }
  }, [handleRenameConfirm]);

  const handleArchive = useCallback(() => {
    setIsDropdownOpen(false);
    onClose();
  }, [onClose]);

  const label = isRenaming ? (
    <input
      ref={inputRef}
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={handleRenameConfirm}
      onKeyDown={handleRenameKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="text-xs font-medium text-primary-900 dark:text-primary-200 bg-transparent outline-none border-b border-primary-400 dark:border-primary-600 w-full"
      maxLength={50}
    />
  ) : (
    <AnimatedTitle title={title} className="text-xs text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200 font-medium truncate flex-1" />
  );

  return (
    <>
      <BaseTab
        isActive={isActive}
        isFirst={isFirst}
        onClick={onClick}
        onClose={handleOptionsClick}
        icon={<TabIcon run={run} variant={variant} isActive={isActive} />}
        label={label}
        closeIcon={<Option className="size-3.5 text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200" />}
      />
      <DropdownMenu
        isOpen={isDropdownOpen}
        position={dropdownPosition}
        onClose={() => setIsDropdownOpen(false)}
        minWidth={140}
      >
        <DropdownMenuItem onClick={handleRenameStart}>
          <Edit className="size-3.5" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleArchive}>
          <Archive className="size-3.5" />
          <span>Archive</span>
        </DropdownMenuItem>
      </DropdownMenu>
    </>
  );
}

export function getTabTitle(run: Run): string {
  if (run.title) return run.title;
  if (run.goal) {
    const truncated = run.goal.length > 25 ? run.goal.substring(0, 25) + "..." : run.goal;
    return truncated;
  }
  return `Run ${run.id.substring(0, 8)}`;
}
