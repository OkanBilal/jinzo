import { Caption, ChartCard, Heading3 } from "@/components/ui";
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
            <Heading3>
              {item.value}
            </Heading3>
            <Caption>
              {item.label}
            </Caption>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
