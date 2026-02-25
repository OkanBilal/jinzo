import Text from "@/components/ui/text";
import type { DashboardSummary } from "@/lib/redux/api";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    { label: "Projects", value: summary.totalProjects },
    { label: "Runs Today", value: summary.runsToday },
    { label: "Total Sessions", value: summary.totalSessions },
    { label: "Est. Cost", value: formatCost(summary.estimatedCostUsd) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 px-4 py-3.5 text-center"
        >
          <Text variant="h2" className="text-xl tracking-tight">
            {card.value}
          </Text>
          <Text variant="caption" className="font-medium mb-1">
            {card.label}
          </Text>
        </div>
      ))}
    </div>
  );
}
