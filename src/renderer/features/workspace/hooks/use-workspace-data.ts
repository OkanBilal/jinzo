import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
} from "@/lib/redux/api/workspacesApi";
import { useGetProvidersByKindQuery } from "@/lib/redux/api/providersApi";

export function useWorkspaceData() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("copilot_cli");

  // Fetch workspaces via RTK Query
  const { data: workspaces = [] } = useGetWorkspacesQuery();

  // Fetch agent runtime providers via RTK Query
  const { data: allProviders = [] } = useGetProvidersByKindQuery("agent_runtime");

  // Filter to only enabled providers
  const providers = useMemo(
    () => allProviders.filter((p) => p.isEnabled),
    [allProviders],
  );

  // Fetch specific workspace by ID if provided in URL
  const { data: fetchedWorkspace } = useGetWorkspaceByIdQuery(workspaceId!, {
    skip: !workspaceId,
  });

  // Derive current workspace from fetched data or workspaces list
  const currentWorkspace = useMemo(() => {
    if (workspaceId) {
      return workspaces.find((w) => w.id === workspaceId) ?? fetchedWorkspace ?? null;
    }
    return workspaces.length > 0 ? workspaces[0] : null;
  }, [workspaceId, workspaces, fetchedWorkspace]);

  // Set default provider when providers load
  useEffect(() => {
    if (providers.length > 0 && selectedProvider === "copilot_cli") {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

  // Update selected workspace when URL or workspaces change
  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspace(workspaceId);
    } else if (workspaces.length > 0) {
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaceId, workspaces]);

  return {
    workspaceId,
    workspaces,
    providers,
    selectedWorkspace,
    selectedProvider,
    currentWorkspace,
    setSelectedProvider,
  };
}
