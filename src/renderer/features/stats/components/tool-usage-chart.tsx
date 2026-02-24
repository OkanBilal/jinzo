import { Apps } from "@/components/ui/icons";
import Text from "@/components/ui/text";
import type { ToolUsageItem } from "@/lib/redux/api";

interface ToolUsageChartProps {
  data: ToolUsageItem[];
}

const BAR_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#A78BFA",
  "#7BB3D4",
  "#4A9E6E",
  "#D4A843",
  "#F59E0B",
  "#9CA3AF",
];

export default function ToolUsageChart({ data }: ToolUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
        <Text variant="caption" className="font-medium mb-3" as="p">
          Top Tools
        </Text>
        <div className="h-36 flex items-center justify-center">
          <Text variant="muted">No tool usage data yet</Text>
        </div>
      </div>
    );
  }

  const items = data.slice(0, 15);
  const maxCount = Math.max(...items.map((d) => d.count));

  return (
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
      <Text
        variant="caption"
        className="font-medium mb-3 flex items-center gap-1.5"
        as="p"
      >
        <Apps className="w-3 h-3" />
        Top Tools
      </Text>
      <div className="flex items-end gap-1.5" style={{ height: 150 }}>
        {items.map((d, i) => {
          const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
          return (
            <div
              key={d.toolName}
              className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              title={`${d.toolName}: ${d.count} calls`}
            >
              <Text variant="caption" className="text-[10px] tabular-nums">
                {d.count}
              </Text>
              <div
                className="w-full rounded-t-sm"
                style={{
                  height: `${Math.max(pct, 3)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {items.map((d) => (
          <div key={d.toolName} className="flex-1 text-center">
            <Text variant="mutedSmall" className="text-[8px] truncate block">
              {d.toolName}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
