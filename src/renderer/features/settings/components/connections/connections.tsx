import { useState, useMemo } from "react";
import { Text, Heading2, Button, toast } from "@/components/ui";
import AsanaModal from "./asana/asana-modal";
import GitHubModal from "./github/github-modal";
import GitLabModal from "./gitlab/gitlab-modal";
import JiraModal from "./jira/jira-modal";
import LinearModal from "./linear/linear-modal";
import TrelloModal from "./trello/trello-modal";
import SentryModal from "./sentry/sentry-modal";
import { useRunEntitySyncMutation } from "@/lib/redux/api/syncApi";
import { AsciiSpinner } from "@/features/workspace/components/ascii-loader";

type ConnectionItem = {
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

interface ConnectionsSettingsProps {
  connections: ConnectionItem[];
  connectedConnections: string[];
  onRefresh?: () => void;
}

type CategoryFilter = "all" | "development" | "planning" | "monitoring";

const FILTER_TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "planning", label: "Planning" },
  { id: "development", label: "Development" },
  { id: "monitoring", label: "Monitoring" },
];

export default function ConnectionsSettings({
  connections,
  connectedConnections,
  onRefresh,
}: ConnectionsSettingsProps) {
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

  const isConnected = (appId: string) => connectedConnections.includes(appId);

  const handleConnectionSuccess = () => {
    onRefresh?.();
  };

  const filteredConnections = useMemo(() => {
    if (filter === "all") return connections;
    return connections.filter((connection) => (connection.category || "developement") === filter);
  }, [connections, filter]);

  const connectedFiltered = filteredConnections.filter((connection) => isConnected(connection.id));
  const notConnectedFiltered = filteredConnections.filter(
    (connection) => !isConnected(connection.id),
  );
  const connectedCount = connections.filter((connection) => isConnected(connection.id)).length;

  return (
    <div className="h-full overflow-y-auto noscrollbar">
      <div className="flex items-center justify-between mb-6">
        <Heading2>Connections</Heading2>
        {connectedCount > 0 && (
          <Button variant="secondary" onClick={handleSync} disabled={isSyncing} className="gap-1 flex items-center" >
            {isSyncing ? <AsciiSpinner variant="null" /> : null}
             <Text variant="button" > {isSyncing ? "Syncing..." : "Sync All"}</Text>
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
          <div className="grid grid-cols-2 gap-6">
            {connectedFiltered.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                connected
                onAction={() => setActiveModal(connection.id)}
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
          <div className="grid grid-cols-2 gap-6 pb-12">
            {notConnectedFiltered.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                connected={false}
                onAction={() => setActiveModal(connection.id)}
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

function ConnectionCard({
  connection,
  connected,
  onAction,
}: {
  connection: ConnectionItem;
  connected: boolean;
  onAction: () => void;
}) {
  return (
    <div className="rounded-3xl glass-morphism  p-4 flex flex-col justify-between">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <ConnectionIcon connection={connection} />
          <span className="text-sm font-medium text-primary-900 dark:text-primary-100 truncate">
            {connection.displayName}
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
          className="rounded-xl!"
        >
          {connected ? "Manage" : "Connect"}
        </Button>
      </div>
    </div>
  );
}

function ConnectionIcon({ connection }: { connection: ConnectionItem }) {
  if (connection.iconPath) {
    return (
      <img
        src={connection.iconPath}
        alt={connection.id}
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
        {connection.displayName?.charAt(0)}
      </Text>
    </div>
  );
}
