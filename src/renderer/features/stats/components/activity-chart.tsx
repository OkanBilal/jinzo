import { Calendar } from "@/components/ui/icons";
import type { DailyActivity } from "@/lib/redux/api";

interface ActivityChartProps {
  data: DailyActivity[];
}

function padTo30(data: DailyActivity[]) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const filled = sorted.map((d) => ({
    claude: d.claude,
    copilot: d.copilot,
    other: d.other,
    total: d.claude + d.copilot + d.other,
  }));
  const padding = 30 - filled.length;
  if (padding > 0) {
    const empty = Array.from({ length: padding }, () => ({
      claude: 0,
      copilot: 0,
      other: 0,
      total: 0,
    }));
    return [...filled, ...empty];
  }
  return filled.slice(-30);
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const chartData = padTo30(data);
  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
      <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3 flex items-center gap-1.5">
        <Calendar className="w-3 h-3" />
        Daily Activity (30d)
      </p>
      <div className="flex items-end gap-0.5" style={{ height: 180 }}>
        {chartData.map((d, i) => {
          const claudePct = (d.claude / maxTotal) * 100;
          const copilotPct = (d.copilot / maxTotal) * 100;
          const otherPct = (d.other / maxTotal) * 100;
          return (
            <div
              key={i}
              className="flex-1 h-full flex flex-col justify-end"
              title={d.total > 0 ? `Claude: ${d.claude}, Copilot: ${d.copilot}, Other: ${d.other}` : ""}
            >
              {d.other > 0 && (
                <div
                  className="w-full rounded-t-sm"
                  style={{ height: `${otherPct}%`, backgroundColor: "#6366F1" }}
                />
              )}
              {d.copilot > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${copilotPct}%`,
                    backgroundColor: "#3010B3",
                    borderRadius: d.other === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
              {d.claude > 0 && (
                <div
                  className="w-full"
                  style={{
                    height: `${claudePct}%`,
                    backgroundColor: "#D97757",
                    borderRadius: d.copilot === 0 && d.other === 0 ? "2px 2px 0 0" : undefined,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
