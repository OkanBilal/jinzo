import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";
import type { RunEvent } from "../../types";
import { Plan, ArrowUp } from "@/components/ui/icons";
import { useUpdateToolCallMutation } from "@/lib/redux/api/toolsApi";
import { Button } from "@/components/ui";

type PlanStatus = "pending" | "applied" | "dismissed";

interface PlanDisplayProps {
  event: RunEvent;
  onApplyPlan?: () => void;
}

export function PlanDisplay({ event, onApplyPlan }: PlanDisplayProps) {
  const [updateToolCall] = useUpdateToolCallMutation();

  const input = event.metadata?.input as Record<string, unknown> | undefined;
  const output = event.metadata?.output as Record<string, unknown> | string | undefined;
  const parsedOutput = typeof output === "string"
    ? (() => { try { return JSON.parse(output); } catch { return {}; } })()
    : output ?? {};

  const savedStatus = (parsedOutput?.planStatus as PlanStatus) ?? "pending";
  const [status, setStatus] = useState<PlanStatus>(savedStatus);
  const [isExpanded, setIsExpanded] = useState(savedStatus !== "dismissed");

  const content = (input?.plan as string) || event.content || "";

  // Skip rendering if there's no actual plan content (e.g. empty start events like "Create Plan: {}")
  if (!content.trim()) return null;
  if (!(input?.plan)) {
    const afterColon = content.indexOf(":") !== -1 ? content.substring(content.indexOf(":") + 1).trim() : content.trim();
    if (!afterColon || afterColon === "{}") return null;
  }

  // Extract tool call DB id from event id (format: "tool-{id}")
  const toolCallId = parseInt(event.id.replace("tool-", ""), 10);

  const persistStatus = async (newStatus: PlanStatus) => {
    setStatus(newStatus);
    if (!isNaN(toolCallId)) {
      await updateToolCall({
        id: toolCallId,
        payload: { output: { planStatus: newStatus } },
      });
    }
  };

  const handleApply = async () => {
    await persistStatus("applied");
    onApplyPlan?.();
  };

  const handleDismiss = async () => {
    await persistStatus("dismissed");
    setIsExpanded(false);
  };

  const isPending = status === "pending";

  return (
    <div className="overflow-hidden rounded-xl glass-morphism flex flex-col my-4">
      {/* Header — badge + collapse toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-primary-100/50 dark:hover:bg-primary-500/10 transition-colors"
      >
        <Plan className="size-3.5 text-primary-500 shrink-0" />
        <span className="text-xs font-medium text-primary-500">
          Plan
        </span>
        {status === "applied" && (
          <span className="flex items-center gap-1 text-xxs text-primary-500">
            Applied
          </span>
        )}
        {status === "dismissed" && (
          <span className="text-xxs text-primary-500">
            Dismissed
          </span>
        )}
        <ArrowUp
          className={`size-3 text-primary-500 ml-auto transition-transform ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
      </button>

      {/* Content — collapsible */}
      {isExpanded && (
        <>
          <div className="relative px-4 pb-3 max-h-100 overflow-y-auto">
            {/* Left accent bar */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={markdownComponents}
                remarkPlugins={[remarkGfm]}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Action buttons — only when pending */}
          {isPending && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-primary-500/10 dark:border-primary-400/10 shrink-0">
              <Button
                variant="submit"
                size="xs"
                onClick={handleApply}
              >
                Apply Plan
              </Button>
              <Button
                variant="secondary"
                size="xs"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
