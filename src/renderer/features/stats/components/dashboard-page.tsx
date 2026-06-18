import { useState } from "react";
import { useGetDashboardQuery } from "@/lib/redux/api";
import type { ProviderFilter } from "@/lib/redux/api";
import SummaryCards from "./summary-cards";
import ActivityChart from "./activity-chart";
import HourHeatmap from "./hour-heatmap";
import CostByModelChart from "./cost-by-model-chart";
import ToolUsageChart from "./tool-usage-chart";
import RecentSessionsList from "./recent-sessions-list";
import { Caption, Heading3, SegmentedTabs } from "@/components/ui";
import SuccessRateChart from "./success-rate-chart";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";

const TABS: { id: ProviderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: PROVIDER_IDS.claude, label: "Claude" },
  { id: PROVIDER_IDS.copilot, label: "Copilot" },
  { id: PROVIDER_IDS.codex, label: "Codex" },
  { id: PROVIDER_IDS.cursor, label: "Cursor" },
];

export default function DashboardPage() {
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const { data, isLoading, isError } = useGetDashboardQuery(filter);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-primary-200 dark:bg-primary-800 rounded" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-primary-200/50 dark:bg-primary-800/20 rounded-lg" />
            ))}
          </div>
          <div className="h-56 bg-primary-200/50 dark:bg-primary-800/20 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Caption>
        Failed to load dashboard data.
      </Caption>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-center justify-between mb-8">
        <Heading3>Dashboard</Heading3>
        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={TABS.map((t) => ({ value: t.id, label: t.label }))}
        />
      </div>

      <SummaryCards summary={data.summary} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActivityChart data={data.dailyActivity} />
        <HourHeatmap data={data.hourDistribution} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CostByModelChart data={data.costByModel} />
        <ToolUsageChart data={data.toolUsage} />
      </div>

      {/* <CodeActivityStats data={data.codeActivity} /> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SuccessRateChart data={data.statusBreakdown} />
        <div className="relative">
          <div className="absolute inset-0">
            <RecentSessionsList sessions={data.recentSessions} />
          </div>
        </div>
      </div>
    </div>
  );
}
