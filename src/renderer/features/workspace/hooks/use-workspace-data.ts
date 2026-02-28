import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
} from "@/lib/redux/api/workspacesApi";
import { useGetProvidersByKindQuery } from "@/lib/redux/api/providersApi";

const EMPTY_PROVIDERS: never[] = [];

export function useWorkspaceData() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  const [userSelectedProvider, setSelectedProvider] =
    useState<string | null>(null);

  const { data: workspaces = [] } = useGetWorkspacesQuery();

  const { data: allProviders = EMPTY_PROVIDERS } =
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

  const selectedProvider = useMemo(() => {
    if (userSelectedProvider) return userSelectedProvider;
    if (providers.length > 0) return providers[0].id;
    return "claude-code";
  }, [userSelectedProvider, providers]);

  const selectedWorkspace = useMemo(() => {
    if (workspaceId) return workspaceId;
    if (workspaces.length > 0) return workspaces[0].id;
    return "";
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
