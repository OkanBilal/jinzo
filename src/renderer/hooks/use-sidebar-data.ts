import { useMemo } from "react";
import {
  useGetConnectionStatesQuery,
  useGetAccountQuery,
  useListWorkspacesQuery,
} from "@/lib/redux/api";
import type { SidebarConfig } from "@/hooks/use-sidebar-config";


interface UseSidebarDataOptions {
  searchQuery: string;
  sidebarConfig: SidebarConfig;
}

export function useSidebarData({ searchQuery, sidebarConfig }: UseSidebarDataOptions) {
  // Data queries
  const { data: account } = useGetAccountQuery();
  const { data: connections = [], refetch: refetchConnections } = useGetConnectionStatesQuery();

  // Workspaces for workspace mode
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } =
    useListWorkspacesQuery(undefined, {
      skip: sidebarConfig.itemType !== "workspace",
    });

  const connectedConnections = useMemo(() => {
    return connections.filter((connection) => connection.isConnected).map((connection) => connection.id);
  }, [connections]);

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

  const handleRefreshConnections = async () => {
    await refetchConnections();
  };

  return {
    account,
    workspaces: filteredWorkspaces,
    connections,
    connectedConnections,
    isLoadingWorkspaces,
    handleRefreshConnections,
  };
}
