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
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
      <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3">
        Code Activity
      </p>
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
    </div>
  );
}
