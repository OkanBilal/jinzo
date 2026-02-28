import { Archive, CopilotStatic } from "@/components/ui/icons";
import type { Run } from "../types";
import { Claude } from "@/components/ui/icons/space";
import { AnimatedTitle } from "@/components/ui/animated-title";
import { BaseTab } from "./base-tab";

interface RunTabProps {
  run: Run;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  title: string;
  variant?: "copilot" | "claude";
}

function VariantIcon({ variant, isActive }: { variant: string; isActive: boolean }) {
  const className = `size-3.5 ${
    isActive
      ? "text-primary-900 dark:text-primary"
      : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"
  }`;

  if (variant === "claude") return <Claude className={className} />;
  if (variant === "copilot") return <CopilotStatic className={className} />;
  return null;
}

export function RunTab({ isActive, onClick, onClose, title, variant = "copilot" }: RunTabProps) {
  return (
    <BaseTab
      isActive={isActive}
      onClick={onClick}
      onClose={onClose}
      icon={<VariantIcon variant={variant} isActive={isActive} />}
      label={<AnimatedTitle title={title} className="text-xs font-medium truncate flex-1" />}
      closeIcon={<Archive className="size-3.5" />}
      variant={variant}
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
