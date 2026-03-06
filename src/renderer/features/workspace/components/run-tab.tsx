import { Archive, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";
import { Claude } from "@/components/ui/icons/space";
import { AnimatedTitle } from "@/components/ui";
import { BaseTab } from "./base-tab";
import { AsciiSpinner } from "./ascii-loader";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  isFirst?: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
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

export function RunTab({ run, isActive, isFirst, onClick, onClose, title, variant = "copilot" }: RunTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      isFirst={isFirst}
      onClick={onClick}
      onClose={onClose}
      icon={<TabIcon run={run} variant={variant} isActive={isActive} />}
      label={<AnimatedTitle title={title} className="text-xs text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200 font-medium truncate flex-1" />}
      closeIcon={<Archive className="size-3.5 text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200" />}
    />
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
