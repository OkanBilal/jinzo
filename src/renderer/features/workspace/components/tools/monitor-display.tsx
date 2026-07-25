import { useState } from "react";
import { Infinite } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse, ToolOutputBody, useToolStatus } from "./_shared";
import { toolOutputText } from "../../utils/parse-tool-content";

/**
 * Input to the `Monitor` tool — a background watch whose event stream is either
 * a shell `command`'s stdout (one notification per line) or a `ws` endpoint's
 * text frames. `persistent` runs for the whole session; otherwise the watch is
 * killed after `timeout_ms`.
 */
export interface MonitorParams {
  description?: string;
  command?: string;
  ws?: { url?: string; protocols?: string[] };
  timeout_ms?: number;
  persistent?: boolean;
}

/** `570000` → `"9m 30s"`. Returns "" for a missing/invalid duration. */
function formatDuration(ms: unknown): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export function MonitorDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: MonitorParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = useToolStatus();

  const wsUrl = params.ws?.url;
  const source = wsUrl ?? params.command ?? "";
  const protocols = params.ws?.protocols?.filter(Boolean) ?? [];
  const result = toolOutputText(output);

  // A persistent watch has no deadline; a bounded one shows its timeout. Once
  // the call is no longer in flight the limit is history, so it only reads as a
  // live badge while running.
  const isRunning = status === "running" || status === "queued";
  const limit = params.persistent ? "persistent" : formatDuration(params.timeout_ms);

  const hasDetails = !!source || !!result;

  return (
    <div>
      <ToolHeader
        icon={<Infinite className="size-4" />}
        verb="Monitored"
        hasDetails={hasDetails}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.description || source || "watch"}
        </span>
        {limit && (
          <span
            className={`shrink-0 text-t tabular-nums ${
              isRunning && params.persistent
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-primary-500/70 group-hover:text-primary-950 group-hover:dark:text-primary"
            }`}
          >
            {limit}
          </span>
        )}
      </ToolHeader>

      {hasDetails && (
        <ToolCollapse isExpanded={isExpanded}>
          <ToolOutputBody as="div" className="text-s font-sans space-y-2">
            {source && (
              <div className="space-y-1">
                <div className="text-t font-medium text-primary-400 dark:text-primary-500">
                  {wsUrl ? "WebSocket" : "Command"}
                </div>
                <pre className="noscrollbar whitespace-pre-wrap break-all font-mono text-t overflow-x-auto">
                  {source}
                </pre>
                {protocols.length > 0 && (
                  <div className="text-t font-mono text-primary-500 dark:text-primary-400">
                    {protocols.join(", ")}
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="pt-1 border-t border-primary-100 dark:border-primary/10">
                <div className="text-t font-medium text-primary-400 dark:text-primary-500 mb-1">
                  {status === "error" ? "Error" : "Events"}
                </div>
                <pre
                  className={`noscrollbar whitespace-pre-wrap text-t font-mono max-h-40 overflow-y-auto ${
                    status === "error" ? "text-red-600 dark:text-red-400" : ""
                  }`}
                >
                  {result}
                </pre>
              </div>
            )}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}
