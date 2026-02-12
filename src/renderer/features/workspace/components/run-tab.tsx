import { Archive, Close, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";
import { Claude, Copilot } from "@/components/ui/icons/mood";
import { Button } from "@/components/ui/button";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  title: string;
  variant?: "workspace" | "claude";
}

export function RunTab({ run, isActive, onClick, onClose, title, variant = "workspace" }: RunTabProps) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 pl-3 pr-1 py-3 cursor-pointer  transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200  ${variant=== "claude" ? "dark:bg-claude-dark bg-primary" : variant === "workspace" ? " dark:bg-copilot-dark bg-primary" : ""} `  
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 "
      }`}
    >
      {variant === "claude" ? (
        <Claude className={`w-4 h-4 ${isActive ? "text-white" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
      ) : variant === "workspace" ? (
        <Copilot className={`w-4 h-4 ${isActive ? "text-white" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
      ) : null}
      <span className="text-xs font-medium truncate flex-1">{title}</span>
      <Button
        tooltip="Archive"
        tooltipPosition="bottom"
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-1 mr-1 hover:bg-primary/10 cursor-pointer rounded transition-all"
      >
        <Archive className="size-3.5" />
      </Button>
    </div>
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
