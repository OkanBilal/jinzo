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
  const [selectedProvider, setSelectedProvider] =
    useState<string>("copilot_cli");

  const { data: workspaces = [] } = useGetWorkspacesQuery();

  const { data: allProviders = [] } =
    useGetProvidersByKindQuery("agent_runtime");

  const providers = useMemo(
    () => allProviders.filter((p) => p.isEnabled),
    [allProviders],
  );

  const { data: fetchedWorkspace } = useGetWorkspaceByIdQuery(workspaceId!, {
    skip: !workspaceId,
  });

  const currentWorkspace = useMemo(() => {
    if (workspaceId) {
      return (
        workspaces.find((w) => w.id === workspaceId) ?? fetchedWorkspace ?? null
      );
    }
    return workspaces.length > 0 ? workspaces[0] : null;
  }, [workspaceId, workspaces, fetchedWorkspace]);

  useEffect(() => {
    if (providers.length > 0 && selectedProvider === "copilot_cli") {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

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
