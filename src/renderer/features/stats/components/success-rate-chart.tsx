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

  if (total === 0) {
    return (
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
        <p className="text-xs font-medium text-primary-500 dark:text-primary-400 flex items-center gap-1.5">
        <Check className="w-3 h-3" />
          Success Rate
        </p>
        <div className="h-36 flex items-center justify-center text-sm text-primary-400 dark:text-primary-500">
          No status data yet
        </div>
      </div>
    );
  }

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
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-medium text-primary-500 dark:text-primary-400 flex items-center gap-1.5">
        <Check className="w-3 h-3" />
          Success Rate
        </p>
        <span className="text-xs font-medium text-primary-400 dark:text-primary-500">
          {total} runs this week
        </span>
      </div>
      <p className="text-2xl font-semibold text-primary-900 dark:text-primary-100 tracking-tight mb-4">
        {rate}%
      </p>

      {/* Bars */}
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {paddedDays.map((day, i) => {
          const dayTotal = day.succeeded + day.failed + day.canceled + day.other;
          const succeededPct = (day.succeeded / maxPerDay) * 100;
          const failedPct = (day.failed / maxPerDay) * 100;
          const canceledPct = (day.canceled / maxPerDay) * 100;
          const otherPct = (day.other / maxPerDay) * 100;

          return (
            <div
              key={day.date || i}
              className="flex-1 h-full flex flex-col justify-end"
              title={dayTotal > 0 ? `${day.dayLabel} · ${dayTotal} runs\nSucceeded: ${day.succeeded}\nFailed: ${day.failed}${day.canceled > 0 ? `\nCanceled: ${day.canceled}` : ""}${day.other > 0 ? `\nOther: ${day.other}` : ""}` : ""}
            >
              {day.other > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${otherPct}%`,
                    backgroundColor: STATUS_COLORS.other,
                    borderRadius: day.canceled === 0 && day.failed === 0 && day.succeeded === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
              {day.canceled > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${canceledPct}%`,
                    backgroundColor: STATUS_COLORS.canceled,
                    borderRadius: day.other === 0 && day.failed === 0 && day.succeeded === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
              {day.failed > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${failedPct}%`,
                    backgroundColor: STATUS_COLORS.failed,
                    borderRadius: day.other === 0 && day.canceled === 0 && day.succeeded === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
              {day.succeeded > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${succeededPct}%`,
                    backgroundColor: STATUS_COLORS.succeeded,
                    borderRadius: day.other === 0 && day.canceled === 0 && day.failed === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-2 mt-1.5">
        {paddedDays.map((day, i) => (
          <div key={day.date || i} className="flex-1 text-center">
            <span className="text-[10px] text-primary-400 dark:text-primary-500">
              {day.dayLabel}
            </span>
          </div>
        ))}
      </div>

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
    </div>
  );
}
