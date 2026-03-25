import { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";
import { Text } from "@/components/ui";
import type { DashboardSummary } from "@/lib/redux/api";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const cards = [
    { label: "Projects", value: summary.totalProjects },
    { label: "Runs Today", value: summary.runsToday },
    { label: "Total Sessions", value: summary.totalSessions },
    { label: "Est. Cost", value: summary.estimatedCostUsd, isCost: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-3xl border border-primary-200/60 dark:border-primary-800/20 bg-primary-50/50 dark:bg-primary-900/30 px-4 py-3.5 text-center"
        >
          <Text variant="h2" className="text-xl tracking-tight">
            <NumberFlow
              value={mounted ? card.value : 0}
              format={
                card.isCost
                  ? { style: "currency", currency: "USD", minimumFractionDigits: 2 }
                  : undefined
              }
              transformTiming={{ duration: 600, easing: "ease-out" }}
              spinTiming={{ duration: 600, easing: "ease-out" }}
            />
          </Text>
          <Text variant="caption" className="font-medium mb-1">
            {card.label}
          </Text>
        </div>
      ))}
    </div>
  );
}
