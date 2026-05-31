import { Tooltip } from "@/components/ui";
import type { ContextUsageSnapshot } from "../hooks/use-context-usage";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface ContextUsageRingProps {
  usage: ContextUsageSnapshot | null;
}

/**
 * Circular context-window indicator. The colored arc is the used portion, the
 * muted track is what remains. Hovering reveals a detailed breakdown. Turns
 * amber near the auto-compact threshold and red once the window is nearly full.
 */
export function ContextUsageRing({ usage }: ContextUsageRingProps) {
  if (!usage || !usage.maxTokens) return null;

  const pct = Math.max(0, Math.min(100, usage.percentage));
  const used = Math.min(usage.totalTokens, usage.maxTokens);
  const remaining = Math.max(0, usage.maxTokens - used);

  const thresholdPct =
    usage.isAutoCompactEnabled && usage.autoCompactThreshold && usage.maxTokens
      ? (usage.autoCompactThreshold / usage.maxTokens) * 100
      : undefined;

  const arcClass =
    pct >= 90
      ? "stroke-red-500"
      : thresholdPct != null && pct >= thresholdPct
        ? "stroke-amber-500"
        : "stroke-primary-500 dark:stroke-primary-300";

  const size = 27;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (circumference * pct) / 100;

  const tooltip = (
    <div className="flex flex-col gap-0.5 py-0.5">
      <span className="font-medium">Context window</span>
      <span className="tabular-nums">
        Used: {used.toLocaleString()} ({pct.toFixed(0)}%)
      </span>
      <span className="tabular-nums">Remaining: {remaining.toLocaleString()}</span>
      <span className="tabular-nums text-primary-400 dark:text-primary-500">
        Total: {usage.maxTokens.toLocaleString()}
      </span>
      {usage.model && (
        <span className="text-primary-400 dark:text-primary-500">{usage.model}</span>
      )}
      {thresholdPct != null && (
        <span className="text-primary-400 dark:text-primary-500">
          Auto-compact at {thresholdPct.toFixed(0)}%
        </span>
      )}
    </div>
  );

  return (
    <Tooltip position="top" content={tooltip}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-primary-200/70 dark:stroke-primary-800"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={`${arcClass} transition-[stroke-dasharray] duration-300`}
          />
        </svg>
        <span className="absolute text-xxs font-medium tabular-nums text-primary-500 dark:text-primary-400">
          {pct.toFixed(0)}
        </span>
      </div>
    </Tooltip>
  );
}
