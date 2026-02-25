import { useState, useRef, useLayoutEffect, useCallback } from "react";
import { useGetDashboardQuery } from "@/lib/redux/api";
import type { ProviderFilter } from "@/lib/redux/api";
import SummaryCards from "./summary-cards";
import ActivityChart from "./activity-chart";
import HourHeatmap from "./hour-heatmap";
import CostByModelChart from "./cost-by-model-chart";
import ToolUsageChart from "./tool-usage-chart";
import RecentSessionsList from "./recent-sessions-list";
import CodeActivityStats from "./code-activity-stats";
import { Heading2 } from "@/components/ui/text";
import SuccessRateChart from "./success-rate-chart";

const TABS: { id: ProviderFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "claude_code", label: "Claude" },
  { id: "copilot_cli", label: "Copilot" },
];

export default function DashboardPage() {
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const { data, isLoading, isError } = useGetDashboardQuery(filter);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const activeTab = tabRefs.current.get(filter);
    if (container && activeTab) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [filter, data]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-primary-200 dark:bg-primary-800 rounded" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-primary-200/50 dark:bg-primary-800/30 rounded-lg" />
            ))}
          </div>
          <div className="h-56 bg-primary-200/50 dark:bg-primary-800/30 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-primary-500 dark:text-primary-400">
        Failed to load dashboard data.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-8">
        <Heading2 className="font-medium!">Dashboard</Heading2>
        <div
          ref={containerRef}
          className="relative flex rounded-[11px] bg-primary-100/60 dark:bg-primary-800/30 p-0.5"
        >
          <div
            className="absolute top-0.5 bg-white dark:bg-primary/10 rounded-lg shadow-sm transition-all duration-300 ease-in-out"
            style={{
              left: indicator.left,
              width: indicator.width,
              height: "calc(100% - 4px)",
            }}
          />
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
              }}
              onClick={() => setFilter(tab.id)}
              className={`relative z-10 flex-1 text-center px-3 py-1 text-xs font-medium rounded-lg transition-colors duration-300 cursor-pointer ${
                filter === tab.id
                  ? "text-primary-900 dark:text-primary-100"
                  : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <SummaryCards summary={data.summary} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActivityChart data={data.dailyActivity} />
        <HourHeatmap data={data.hourDistribution} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CostByModelChart data={data.costByModel} />
        <ToolUsageChart data={data.toolUsage} />
      </div>

      {/* <CodeActivityStats data={data.codeActivity} /> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
