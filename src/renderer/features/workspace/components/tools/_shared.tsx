import { type ReactNode } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { Button } from "@/components/ui";

interface ToolHeaderProps {
  /** Tool icon (e.g. <Bash />, <Glob />). Hidden when `isCompact`. */
  icon: ReactNode;
  /** Verb label (e.g. "Ran", "Searched", "Read"). Hidden when `isCompact`. */
  verb: ReactNode;
  /** When false, click is a no-op and the chevron is suppressed. */
  hasDetails: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isCompact?: boolean;
  /** Middle slot rendered between verb and chevron — provider-specific content
   *  (file path, pattern, stats, char count, etc.). */
  children?: ReactNode;
}

/**
 * Shared toggle header used by every tool-call display. Owns the
 * icon + verb + chevron + group-hover styling so the per-tool files
 * only describe the middle slot and the expand body.
 */
export function ToolHeader({
  icon,
  verb,
  hasDetails,
  isExpanded,
  onToggle,
  isCompact = false,
  children,
}: ToolHeaderProps) {
  return (
    <Button
      type="button"
      onClick={() => hasDetails && onToggle()}
      className={`group w-full min-w-0 flex items-center gap-1 py-1 text-s font-sans ${
        hasDetails ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {!isCompact && (
        <span className="shrink-0 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary">
          {icon}
        </span>
      )}
      {!isCompact && (
        <span className="shrink-0 text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
          {verb}
        </span>
      )}
      {children}
      {hasDetails && (
        <ArrowUp
          className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${
            isExpanded ? "rotate-180" : "rotate-90"
          }`}
        />
      )}
    </Button>
  );
}

/**
 * CSS-grid based collapse wrapper. The body content (pre/div, font choice,
 * padding, max-height) stays at the call site — only the open/close animation
 * is centralised here.
 */
export function ToolCollapse({
  isExpanded,
  children,
  className = "",
}: {
  isExpanded: boolean;
  children: ReactNode;
  /** Extra classes merged onto the outer grid (e.g. border/rounded for diff bodies). */
  className?: string;
}) {
  return (
    <div
      className={`grid transition-all duration-200 ease-out ${
        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
