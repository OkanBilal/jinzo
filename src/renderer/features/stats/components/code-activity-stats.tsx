import { ChartCard } from "@/components/ui/charts";
import type { CodeActivityStats as CodeActivityData } from "@/lib/redux/api";

interface CodeActivityStatsProps {
  data: CodeActivityData;
}

export default function CodeActivityStats({ data }: CodeActivityStatsProps) {
  const items = [
    { label: "Diffs", value: data.totalDiffs },
    { label: "Files Changed", value: data.totalFilesChanged },
  ];

  return (
    <ChartCard title="Code Activity">
      <div className="flex gap-6">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
              {item.value}
            </p>
            <p className="text-xs text-primary-500 dark:text-primary-400">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
