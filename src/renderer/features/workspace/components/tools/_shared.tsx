import { createContext, useContext, type ReactNode } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import { SquareSpinner } from "@/components/ui/square-spinner";
import type { RunEvent } from "../../types";

/**
 * Tool-call lifecycle status, mirroring the `tool_calls.status` column
 * (`queued → running → done | error | canceled`). Surfaced on each event via
 * `metadata.status` in `run-event-mappers.ts`.
 */
export type ToolStatus = "queued" | "running" | "done" | "error" | "canceled";

/**
 * Status of the currently-rendered tool call. `ToolCallItem` provides the value
 * for a single call; `ToolSubGroupAccordion` provides the aggregate for a
 * collapsed multi-call group. Defaults to `done` so historical/legacy events
 * (no status) render exactly as before.
 */
const ToolStatusContext = createContext<ToolStatus>("done");
export const ToolStatusProvider = ToolStatusContext.Provider;
export function useToolStatus(): ToolStatus {
  return useContext(ToolStatusContext);
}

/** Read a normalized `ToolStatus` off an event's metadata (unknown → "done"). */
export function eventToolStatus(event: RunEvent): ToolStatus {
  const raw = event.metadata?.status;
  if (
    raw === "running" ||
    raw === "queued" ||
    raw === "error" ||
    raw === "canceled"
  ) {
    return raw;
  }
  return "done";
}

/**
 * Roll several tool calls up into one status for a group header. Severity order:
 * error > running > done > canceled. A group with any failure reads as failed;
 * any in-flight call reads as running; everything else settles to done.
 */
export function aggregateToolStatus(events: RunEvent[]): ToolStatus {
  let hasRunning = false;
  let hasError = false;
  let hasDone = false;
  let hasCanceled = false;
  for (const event of events) {
    switch (eventToolStatus(event)) {
      case "error":
        hasError = true;
        break;
      case "running":
      case "queued":
        hasRunning = true;
        break;
      case "canceled":
        hasCanceled = true;
        break;
      default:
        hasDone = true;
    }
  }
  if (hasError) return "error";
  if (hasRunning) return "running";
  if (hasDone) return "done";
  if (hasCanceled) return "canceled";
  return "done";
}

/**
 * Past-tense → present-participle map. Keyed by the lowercased past form so it
 * covers both built-in verbs ("Ran", "Read", "Edited") and the past-tense words
 * baked into MCP display names ("Linear **listed** issues"). Words not present
 * here are left untouched.
 */
const GERUND_BY_PAST: Record<string, string> = {
  // DEFAULT_VERBS (tool-registry) past forms
  listed: "listing",
  got: "getting",
  fetched: "fetching",
  read: "reading",
  searched: "searching",
  researched: "researching",
  saved: "saving",
  created: "creating",
  updated: "updating",
  deleted: "deleting",
  archived: "archiving",
  extracted: "extracting",
  added: "adding",
  removed: "removing",
  sent: "sending",
  ran: "running",
  drafted: "drafting",
  replied: "replying",
  opened: "opening",
  closed: "closing",
  // Built-in display verbs not covered above
  grepped: "grepping",
  viewed: "viewing",
  edited: "editing",
  committed: "committing",
  checked: "checking",
  wrote: "writing",
};

function gerundOf(word: string): string | null {
  const gerund = GERUND_BY_PAST[word.toLowerCase()];
  if (!gerund) return null;
  // Preserve the original capitalization of the first letter.
  return word[0] === word[0]?.toUpperCase()
    ? gerund[0].toUpperCase() + gerund.slice(1)
    : gerund;
}

/**
 * Convert a past-tense verb label to its present-participle form by rewriting
 * the first recognized verb word. Handles single words ("Read" → "Reading"),
 * multi-word built-ins ("Saved findings" → "Saving findings"), and MCP
 * sentences where the verb is not the first word ("Linear listed issues" →
 * "Linear listing issues"). Returns the label unchanged when no verb matches.
 */
export function toPresentTense(label: string): string {
  const words = label.split(" ");
  for (let i = 0; i < words.length; i++) {
    const gerund = gerundOf(words[i]);
    if (gerund) {
      words[i] = gerund;
      return words.join(" ");
    }
  }
  return label;
}

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
 *
 * Status-aware: reads `useToolStatus()` and, when the call is in flight, swaps
 * the icon for a spinner and rewrites a string verb to present tense
 * ("Reading…"). Failed calls go red; canceled calls are muted/struck through.
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
  const status = useToolStatus();
  const isRunning = status === "running" || status === "queued";

  // Present-tense only applies to plain string verbs; ReactNode verbs pass through.
  const verbContent =
    isRunning && typeof verb === "string" ? toPresentTense(verb) : verb;

  return (
    <Button
      type="button"
      onClick={() => hasDetails && onToggle()}
      className={`group w-full min-w-0 flex items-center gap-1 py-1 text-s font-sans ${
        hasDetails ? "cursor-pointer" : "cursor-default"
      }`}
    >
      {!isCompact && (
        <span
          className={`shrink-0 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary`}
        >
          {isRunning ? <SquareSpinner /> : icon}
        </span>
      )}
      {!isCompact && (
        <span
          className={`shrink-0 font-medium text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary`}
        >
          {verbContent}
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
