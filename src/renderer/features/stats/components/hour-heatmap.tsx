import { Clock } from "@/components/ui/icons";
import type { HourDistribution } from "@/lib/redux/api";

interface HourHeatmapProps {
  data: HourDistribution[];
}

const LABEL_HOURS = [0, 6, 12, 18];

// Night 0-5, Morning 6-11, Afternoon 12-17, Evening 18-23
const PERIOD_COLORS = ["#D4A843", "#4A9E6E", "#3D7A45", "#5B8DBF"];

function getBarColor(hour: number): string {
  if (hour < 6) return PERIOD_COLORS[0];
  if (hour < 12) return PERIOD_COLORS[1];
  if (hour < 18) return PERIOD_COLORS[2];
  return PERIOD_COLORS[3];
}

export default function HourHeatmap({ data }: HourHeatmapProps) {
  const full = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: data.find((d) => d.hour === i)?.count ?? 0,
  }));

  const maxCount = Math.max(...full.map((d) => d.count), 1);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
        <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3">
          Hour Distribution
        </p>
        <div className="h-44 flex items-center justify-center text-sm text-primary-400 dark:text-primary-500">
          No data yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
      <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Hour Distribution
      </p>
      <div className="flex items-end gap-0.5" style={{ height: 150 }}>
        {full.map((d) => {
          const pct = (d.count / maxCount) * 100;
          return (
            <div
              key={d.hour}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${d.hour}:00 – ${d.hour}:59 · ${d.count} runs`}
            >
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${Math.max(pct, d.count > 0 ? 3 : 0)}%`,
                  backgroundColor: getBarColor(d.hour),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex mt-1.5">
        {full.map((d) => (
          <div key={d.hour} className="flex-1 text-center">
            {LABEL_HOURS.includes(d.hour) && (
              <span className="text-[9px] text-primary-400 dark:text-primary-500">
                {d.hour}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
