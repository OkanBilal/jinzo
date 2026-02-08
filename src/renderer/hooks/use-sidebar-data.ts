import { useMemo } from "react";
import {
  useGetChatSessionsQuery,
  useGetAppsQuery,
  useGetAccountQuery,
  useGetJournalEntriesQuery,
  useGetWorkspacesQuery,
} from "@/lib/redux/api";
import type { SidebarConfig } from "@/hooks/use-sidebar-config";

function filterItems<
  T extends {
    title?: string | null;
    initialQuery?: string | null;
    description?: string | null;
  },
>(items: T[] | undefined, query: string): T[] {
  if (!items || !query.trim()) return items || [];
  const lowerQuery = query.toLowerCase().trim();
  return items.filter((item) => {
    const title = (item.title || item.initialQuery || "").toString();
    const description = (item.description || "").toString();
    return (
      title.toLowerCase().includes(lowerQuery) ||
      description.toLowerCase().includes(lowerQuery)
    );
  });
}

interface UseSidebarDataOptions {
  searchQuery: string;
  sidebarConfig: SidebarConfig;
}

export function useSidebarData({ searchQuery, sidebarConfig }: UseSidebarDataOptions) {
  // Data queries
  const { data: sessions, isLoading: isLoadingSessions } = useGetChatSessionsQuery();
  const { data: account } = useGetAccountQuery();
  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();

  // Journal entries for post mode
  const { data: journalEntries = [], isLoading: isLoadingJournal } =
    useGetJournalEntriesQuery(
      { limit: 50 },
      { skip: sidebarConfig.itemType !== "post" },
    );

  // Workspaces for workspace mode
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } =
    useGetWorkspacesQuery(undefined, {
      skip: sidebarConfig.itemType !== "workspace",
    });

  // Convert journal entries to a format compatible with existing entity type
  const entities = useMemo(() => {
    return journalEntries.map((entry) => ({
      id: entry.id,
      accountId: entry.accountId,
      kind: "journal_entry",
      title: entry.title || "Untitled",
      url: `/journal/${entry.id}`,
      body: entry.body,
      summary: entry.summary,
      occurredAt: entry.occurredAt || entry.createdAt,
      connectionId: null,
      resourceId: null,
      externalId: null,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }, [journalEntries]);

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

  // Filtered data
  const filteredSessions = useMemo(
    () => filterItems(sessions, searchQuery),
    [sessions, searchQuery],
  );

  const filteredEntities = useMemo(
    () => filterItems(entities, searchQuery),
    [entities, searchQuery],
  );

  // Filtered workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces || !searchQuery.trim()) return workspaces || [];
    const lowerQuery = searchQuery.toLowerCase().trim();
    return workspaces.filter((ws) => {
      return (
        ws.name.toLowerCase().includes(lowerQuery) ||
        ws.rootPath.toLowerCase().includes(lowerQuery) ||
        (ws.defaultBranch &&
          ws.defaultBranch.toLowerCase().includes(lowerQuery))
      );
    });
  }, [workspaces, searchQuery]);

  const handleRefreshApps = async () => {
    await refetchApps();
  };

  return {
    account,
    sessions: filteredSessions,
    entities: filteredEntities,
    workspaces: filteredWorkspaces,
    apps,
    connectedApps,
    isLoadingSessions,
    isLoadingEntities: isLoadingJournal,
    isLoadingWorkspaces,
    handleRefreshApps,
  };
}
