import { Apps } from "@/components/ui/icons";
import Text from "@/components/ui/text";
import { ChartCard, BarChart, BarLabels } from "@/components/ui/charts";
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
  const items = data.slice(0, 15);
  const maxCount = Math.max(...items.map((d) => d.count), 1);

  return (
    <ChartCard
      title="Top Tools"
      icon={Apps}
      isEmpty={data.length === 0}
      emptyMessage="No tool usage data yet"
    >
      <BarChart
        height={150}
        gap="gap-1.5"
        bars={items.map((d, i) => ({
          key: d.toolName,
          hoverLabel: `${d.toolName}: ${d.count}`,
          topLabel: (
            <Text variant="caption" className="text-[10px] tabular-nums">
              {d.count}
            </Text>
          ),
          segments: [
            {
              percent: Math.max((d.count / maxCount) * 100, 3),
              color: BAR_COLORS[i % BAR_COLORS.length],
            },
          ],
        }))}
      />
      <BarLabels
        gap="gap-1.5"
        labels={items.map((d) => ({
          key: d.toolName,
          content: (
            <Text
              variant="mutedSmall"
              className="text-[8px] truncate block max-w-full"
              as="span"
              title={d.toolName}
            >
              {d.toolName}
            </Text>
          ),
        }))}
      />
    </ChartCard>
  );
}
