import { useMemo } from "react";
import { Body, Muted, Caption, Toggle } from "@/components/ui";
import {
  useGetAutomationsQuery,
  useCreateAutomationMutation,
  useUpdateAutomationMutation,
  useDeleteAutomationMutation,
} from "@/lib/redux/api";

interface AutoSyncSectionProps {
  provider: string;
  providerLabel: string;
}

const INTERVAL_OPTIONS = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
  { value: 480, label: "8h" },
  { value: 1440, label: "24h" },
];

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "Never";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function AutoSyncSection({
  provider,
  providerLabel,
}: AutoSyncSectionProps) {
  const action = `sync:${provider}`;

  const { data: automations = [] } = useGetAutomationsQuery();
  const [createAutomation] = useCreateAutomationMutation();
  const [updateAutomation] = useUpdateAutomationMutation();
  const [deleteAutomation] = useDeleteAutomationMutation();

  const syncAutomation = useMemo(
    () => automations.find((a) => a.action === action),
    [automations, action],
  );

  const isEnabled = syncAutomation?.isActive ?? false;
  const interval = syncAutomation?.intervalMinutes ?? 30;

  const handleToggle = async () => {
    if (isEnabled && syncAutomation) {
      await deleteAutomation(syncAutomation.id);
    } else {
      await createAutomation({
        accountId: "default",
        input: {
          name: `Auto-sync ${providerLabel}`,
          kind: "sync",
          action,
          intervalMinutes: 30,
          isActive: true,
        },
      });
    }
  };

  const handleIntervalChange = async (newInterval: number) => {
    if (syncAutomation) {
      await updateAutomation({
        id: syncAutomation.id,
        input: { intervalMinutes: newInterval },
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Body className="text-primary-900 dark:text-primary-100">
            Auto Sync
          </Body>
          <Muted className="text-xs">
            Automatically sync {providerLabel} data on a schedule
          </Muted>
        </div>
        <Toggle
          enabled={isEnabled ?? false}
          onChange={() => handleToggle()}
        />
      </div>

      <div className=" space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Caption>Every</Caption>
            <div className="inline-flex rounded-xl border border-primary-200/50 dark:border-primary-800/40 overflow-hidden">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={!isEnabled}
                  onClick={() => handleIntervalChange(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    !isEnabled
                      ? "bg-primary-100 dark:bg-primary-900 text-primary-400 dark:text-primary-600 cursor-not-allowed opacity-50"
                      : interval === opt.value
                        ? "bg-primary-900 dark:bg-primary-200 text-primary dark:text-primary-900 cursor-pointer"
                        : "bg-primary dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 cursor-pointer"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {syncAutomation?.lastRunAt && (
            <Caption className="text-primary-500">
              Last synced: {formatTimeAgo(syncAutomation.lastRunAt)}
            </Caption>
          )}
        </div>
      </div>
    </div>
  );
}
