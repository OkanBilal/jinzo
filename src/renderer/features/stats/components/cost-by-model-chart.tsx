import { Cost } from "@/components/ui/icons";
import { ChartCard } from "@/components/ui/charts";
import type { CostByModel } from "@/lib/redux/api";

interface CostByModelChartProps {
  data: CostByModel[];
}

const BAR_COLORS = ["#A34D35", "#D97757", "#F0B9A5", "#B25A3F", "#F0B9A5", "#A34D35"];

const MODEL_LABELS: Record<string, string> = {
  default: "Opus 4.6",
  sonnet: "Sonnet 4.6",
  haiku: "Haiku 4.5",
};

function displayModel(model: string): string {
  return MODEL_LABELS[model] ?? model;
}

export default function CostByModelChart({ data }: CostByModelChartProps) {
  const maxCost = Math.max(...data.map((d) => d.costUsd), 1);

  return (
    <ChartCard
      title="Cost by Model"
      icon={Cost}
      isEmpty={data.length === 0}
      emptyMessage="No cost data yet"
    >
      <div className="space-y-2.5">
        {data.map((d, i) => {
          const pct = maxCost > 0 ? (d.costUsd / maxCost) * 100 : 0;
          return (
            <div key={d.model} className="flex items-center gap-3" title={`${d.model}: $${d.costUsd.toFixed(2)} · ${d.runs} runs`}>
              <span className="text-xs text-primary-500 dark:text-primary-400 w-20 shrink-0 truncate">
                {displayModel(d.model)}
              </span>
              <div className="flex-1 h-5 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              </div>
              <span className="text-xs text-primary-500 dark:text-primary-400 w-16 text-right shrink-0 tabular-nums">
                ${d.costUsd.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
