import { useMemo } from "react";
import {
  useGetAppsQuery,
  useGetAccountQuery,
  useGetWorkspacesQuery,
} from "@/lib/redux/api";
import type { SidebarConfig } from "@/hooks/use-sidebar-config";


interface UseSidebarDataOptions {
  searchQuery: string;
  sidebarConfig: SidebarConfig;
}

export function useSidebarData({ searchQuery, sidebarConfig }: UseSidebarDataOptions) {
  // Data queries
  const { data: account } = useGetAccountQuery();
  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();

  // Workspaces for workspace mode
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } =
    useGetWorkspacesQuery(undefined, {
      skip: sidebarConfig.itemType !== "workspace",
    });

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

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
    workspaces: filteredWorkspaces,
    apps,
    connectedApps,
    isLoadingWorkspaces,
    handleRefreshApps,
  };
}
