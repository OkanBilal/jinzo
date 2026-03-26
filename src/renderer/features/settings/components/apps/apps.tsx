import { useState, useMemo } from "react";
import { Text, Heading2, Button, toast } from "@/components/ui";
import AsanaModal from "../../components/apps/asana/asana-modal";
import GitHubModal from "../../components/apps/github/github-modal";
import GitLabModal from "../../components/apps/gitlab/gitlab-modal";
import JiraModal from "../../components/apps/jira/jira-modal";
import LinearModal from "../../components/apps/linear/linear-modal";
import TrelloModal from "../../components/apps/trello/trello-modal";
import SentryModal from "../../components/apps/sentry/sentry-modal";
import { useRunEntitySyncMutation } from "@/lib/redux/api/syncApi";

type AppItem = {
  id: string;
  displayName: string | null;
  iconPath: string | null;
  isConnected: boolean;
  connectionId: string | null;
  category: string | null;
  sortOrder: number;
  enabledFeatures: string | null;
  config: string | null;
};

interface AppsSettingsProps {
  apps: AppItem[];
  connectedApps: string[];
  onRefresh?: () => void;
}

type CategoryFilter = "all" | "development" | "planning" | "monitoring";

const FILTER_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "planning", label: "Planning" },
  { id: "development", label: "Development" },
  { id: "monitoring", label: "Monitoring" },
];

export default function AppsSettings({
  apps,
  connectedApps,
  onRefresh,
}: AppsSettingsProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [runSync, { isLoading: isSyncing }] = useRunEntitySyncMutation();

  const handleSync = async () => {
    try {
      const result = await runSync().unwrap();
      if (result.success) {
        toast.success(
          `Sync complete: ${result.inserted} added, ${result.updated} updated`,
        );
      } else {
        toast.error("Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    }
  };

  const isConnected = (appId: string) => connectedApps.includes(appId);

  const handleConnectionSuccess = () => {
    onRefresh?.();
  };

  const filteredApps = useMemo(() => {
    if (filter === "all") return apps;
    return apps.filter((app) => (app.category || "developement") === filter);
  }, [apps, filter]);

  const connectedFiltered = filteredApps.filter((app) => isConnected(app.id));
  const notConnectedFiltered = filteredApps.filter(
    (app) => !isConnected(app.id),
  );
  const connectedCount = apps.filter((app) => isConnected(app.id)).length;

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between mb-6">
        <Heading2>Connections</Heading2>
        {connectedCount > 0 && (
          <Button variant="secondary" onClick={handleSync} disabled={isSyncing}>
            <Text variant="button">
              {isSyncing ? "Syncing..." : "Sync All"}
            </Text>
          </Button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-2.5 py-1 text-sm rounded-xl transition-colors cursor-pointer ${
              filter === tab.id
                ? "bg-primary-200/80 dark:bg-primary-800/60 text-primary-900 dark:text-primary-100 "
                : "text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-200 hover:bg-primary-100/50 dark:hover:bg-primary-800/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connected */}
      {connectedFiltered.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            Connected
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {connectedFiltered.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                connected
                onAction={() => setActiveModal(app.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available */}
      {notConnectedFiltered.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100 mb-3">
            Available
          </h3>
          <div className="grid grid-cols-2 gap-4 pb-12">
            {notConnectedFiltered.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                connected={false}
                onAction={() => setActiveModal(app.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <GitHubModal
        open={activeModal === "github"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("github")}
        onSuccess={handleConnectionSuccess}
      />
      <GitLabModal
        open={activeModal === "gitlab"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("gitlab")}
        onSuccess={handleConnectionSuccess}
      />
      <JiraModal
        open={activeModal === "jira"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("jira")}
        onSuccess={handleConnectionSuccess}
      />
      <AsanaModal
        open={activeModal === "asana"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("asana")}
        onSuccess={handleConnectionSuccess}
      />
      <LinearModal
        open={activeModal === "linear"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("linear")}
        onSuccess={handleConnectionSuccess}
      />
      <TrelloModal
        open={activeModal === "trello"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("trello")}
        onSuccess={handleConnectionSuccess}
      />
      <SentryModal
        open={activeModal === "sentry"}
        onClose={() => setActiveModal(null)}
        isConnected={isConnected("sentry")}
        onSuccess={handleConnectionSuccess}
      />
    </div>
  );
}

function AppCard({
  app,
  connected,
  onAction,
}: {
  app: AppItem;
  connected: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-3xl bg-primary-100/60 dark:bg-primary-900/40 border border-primary-200/50 dark:border-primary-800/20 p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <AppIcon app={app} />
          <span className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate">
            {app.displayName}
          </span>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ml-2 ${
            connected
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-primary-200/60 dark:bg-primary-800/20 text-primary-500 dark:text-primary-400"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant={connected ? "primary" : "secondary"}
          onClick={onAction}
          className="rounded-[12px]!"
        >
          {connected ? "Manage" : "Connect"}
        </Button>
      </div>
    </div>
  );
}

function AppIcon({ app }: { app: AppItem }) {
  if (app.iconPath) {
    return (
      <img
        src={app.iconPath}
        alt={app.id}
        width={32}
        height={32}
        className="size-8 rounded-lg object-cover"
      />
    );
  }

  return (
    <div className="size-8 flex items-center justify-center bg-primary-200 dark:bg-primary-700 rounded-lg">
      <Text
        variant="h3"
        className="text-primary-800 dark:text-primary-200 text-sm"
      >
        {app.displayName?.charAt(0)}
      </Text>
    </div>
  );
}
