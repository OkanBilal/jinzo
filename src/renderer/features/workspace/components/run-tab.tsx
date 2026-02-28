import { Archive, Close, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";
import { Claude, Copilot } from "@/components/ui/icons/space";
import { Button } from "@/components/ui/button";
import { AnimatedTitle } from "@/components/ui/animated-title";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  title: string;
  variant?: "copilot" | "claude";
}

export function RunTab({ run, isActive, onClick, onClose, title, variant = "copilot" }: RunTabProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer  transition-colors min-w-40 max-w-48 ${
        isActive
          ? `text-primary-950 dark:text-primary-200  ${variant=== "claude" ? "dark:bg-claude-dark" : variant === "copilot" ? " dark:bg-copilot-dark bg-primary" : ""} `  
          : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 "
      }`}
    >
      {variant === "claude" ? (
        <Claude className={`size-3.5 ${isActive ? "text-primary-900 dark:text-primary" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
      ) : variant === "copilot" ? (
        <CopilotStatic className={`size-3.5 ${isActive ? "text-primary-900 dark:text-primary" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
      ) : null}
      <AnimatedTitle title={title} className="text-xs font-medium truncate flex-1" />
      <Button
        tooltip="Archive"
        tooltipPosition="bottom"
        onClick={onClose}
        className="opacity-0 group-hover:opacity-100 p-1!  hover:bg-primary/8 cursor-pointer rounded transition-all"
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
