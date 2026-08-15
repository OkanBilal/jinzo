import { Tooltip } from "@/components/ui";
import type { ContextUsageSnapshot } from "../hooks/use-context-usage";


interface ContextUsageRingProps {
  usage: ContextUsageSnapshot | null;
}

type Tone = "normal" | "warn" | "critical";

/** Arc / bar / number colors keyed by fill severity, so the ring and the
 *  tooltip always read as the same state. */
const TONE = {
  normal: {
    stroke: "stroke-primary-500 dark:stroke-primary-300",
    fill: "bg-primary-500 dark:bg-primary-300",
    text: "text-primary-700 dark:text-primary-300",
  },
  warn: {
    stroke: "stroke-warning",
    fill: "bg-warning",
    text: "text-warning",
  },
  critical: {
    stroke: "stroke-danger",
    fill: "bg-danger",
    text: "text-danger",
  },
} satisfies Record<Tone, { stroke: string; fill: string; text: string }>;

function MetricRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-primary-600 dark:text-primary-400">{label}</span>
      <span
        className={`tabular-nums ${
          emphasis
            ? "font-medium text-primary-900 dark:text-primary-100"
            : "text-primary-600 dark:text-primary-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
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

  const tone: Tone =
    pct >= 90
      ? "critical"
      : thresholdPct != null && pct >= thresholdPct
        ? "warn"
        : "normal";
  const { stroke: arcClass, fill: barClass, text: toneText } = TONE[tone];

  const size = 27;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (circumference * pct) / 100;

  const tooltip = (
    <div className="flex w-49 flex-col gap-2 text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-t font-medium uppercase tracking-wider text-primary-600 dark:text-primary-400">
          Context window
        </span>
        <span className={`text-s font-semibold tabular-nums ${toneText}`}>
          {pct.toFixed(0)}%
        </span>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary-200/70 dark:bg-primary-800">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${barClass}`}
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
        />
        {thresholdPct != null && (
          <span
            className="absolute inset-y-0 w-px bg-primary-950/30 dark:bg-primary-100/40"
            style={{ left: `${Math.min(thresholdPct, 100)}%` }}
          />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <MetricRow label="Used" value={used.toLocaleString()} emphasis />
        <MetricRow label="Remaining" value={remaining.toLocaleString()} />
        <MetricRow label="Total" value={usage.maxTokens.toLocaleString()} />
      </div>

      {(usage.model || thresholdPct != null) && (
        <div className="flex items-center justify-between gap-3 border-t border-primary-950/10 pt-1.5 text-xxs text-primary-600 dark:border-primary-100/10 dark:text-primary-400">
          {usage.model && <span className="min-w-0 truncate">{usage.model}</span>}
          {thresholdPct != null && (
            <span className="shrink-0 tabular-nums">
              compacts at {thresholdPct.toFixed(0)}%
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip position="top-left" content={tooltip} className="p-2.5 rounded-xl">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Context window ${pct.toFixed(0)}% used`}
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
        <span className="absolute text-xxs font-medium tabular-nums text-primary-600 dark:text-primary-400">
          {pct.toFixed(0)}
        </span>
      </div>
    </Tooltip>
  );
}
