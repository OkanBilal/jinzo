import { ChartCard, BarChart, BarLabels } from "@/components/ui";
import { Check } from "@/components/ui/icons";
import type { StatusBreakdown } from "@/lib/redux/api";

interface SuccessRateChartProps {
  data: StatusBreakdown;
}

const STATUS_COLORS = {
  succeeded: "#22C55E",
  failed: "#f44336",
  canceled: "#9CA3AF",
  other: "#F59E0B",
};

function padTo7(days: StatusBreakdown["days"]) {
  if (days.length >= 7) return days.slice(-7);
  const pad = 7 - days.length;
  const empty = Array.from({ length: pad }, (_, i) => ({
    date: `empty-${i}`,
    dayLabel: "",
    succeeded: 0,
    failed: 0,
    canceled: 0,
    other: 0,
  }));
  return [...days, ...empty];
}

export default function SuccessRateChart({ data }: SuccessRateChartProps) {
  const total = data.totalSucceeded + data.totalFailed + data.totalCanceled + data.totalOther;
  const rate = total > 0 ? Math.round((data.totalSucceeded / total) * 100) : 0;
  const paddedDays = padTo7(data.days);
  const maxPerDay = Math.max(
    ...paddedDays.map((d) => d.succeeded + d.failed + d.canceled + d.other),
    1,
  );

  const legendItems = [
    { label: "Succeeded", color: STATUS_COLORS.succeeded, count: data.totalSucceeded },
    { label: "Failed", color: STATUS_COLORS.failed, count: data.totalFailed },
    ...(data.totalCanceled > 0
      ? [{ label: "Canceled", color: STATUS_COLORS.canceled, count: data.totalCanceled }]
      : []),
    ...(data.totalOther > 0
      ? [{ label: "Other", color: STATUS_COLORS.other, count: data.totalOther }]
      : []),
  ];

  return (
    <ChartCard
      title="Success Rate"
      icon={Check}
      isEmpty={total === 0}
      emptyMessage="No status data yet"
      headerRight={
        total > 0 ? (
          <span className="text-xs font-medium text-primary-400 dark:text-primary-500">
            {total} runs this week
          </span>
        ) : undefined
      }
    >
      <p className="text-2xl font-semibold text-primary-900 dark:text-primary-100 tracking-tight mb-4">
        {rate}%
      </p>

      <BarChart
        height={120}
        gap="gap-2"
        bars={paddedDays.map((day, i) => {
          const dayTotal = day.succeeded + day.failed + day.canceled + day.other;
          return {
            key: day.date || i,
            hoverLabel: dayTotal > 0 ? `${day.dayLabel} · ${dayTotal}` : undefined,
            segments: [
              { percent: (day.other / maxPerDay) * 100, color: STATUS_COLORS.other },
              { percent: (day.canceled / maxPerDay) * 100, color: STATUS_COLORS.canceled },
              { percent: (day.failed / maxPerDay) * 100, color: STATUS_COLORS.failed },
              { percent: (day.succeeded / maxPerDay) * 100, color: STATUS_COLORS.succeeded },
            ],
          };
        })}
      />

      <BarLabels
        gap="gap-2"
        labels={paddedDays.map((day, i) => ({
          key: day.date || i,
          content: (
            <span className="text-[10px] text-primary-400 dark:text-primary-500">
              {day.dayLabel}
            </span>
          ),
        }))}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-primary-500 dark:text-primary-400">
              {item.label}
            </span>
            <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
