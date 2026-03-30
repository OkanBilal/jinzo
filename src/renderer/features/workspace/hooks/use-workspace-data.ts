import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  useGetWorkspacesQuery,
  useGetWorkspaceByIdQuery,
} from "@/lib/redux/api/workspacesApi";
import { useGetProvidersByKindQuery } from "@/lib/redux/api/providersApi";
import type { RootState } from "@/lib/redux";

const EMPTY_PROVIDERS: never[] = [];

export function useWorkspaceData(providerId?: string) {
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  const savedWorkspaceIdByProvider = useSelector(
    (state: RootState) => state.workspace.activeWorkspaceIdByProvider,
  );

  const [userSelectedProvider, setSelectedProvider] =
    useState<string | null>(null);

  const { data: workspaces = [] } = useGetWorkspacesQuery();

  const { data: allProviders = EMPTY_PROVIDERS } =
    useGetProvidersByKindQuery("agent_runtime");

  const providers = useMemo(
    () => allProviders.filter((p) => p.isEnabled),
    [allProviders],
  );

  // Resolve effective workspace ID: URL param > saved per-provider > first workspace
  const effectiveWorkspaceId = useMemo(() => {
    if (workspaceId) return workspaceId;
    if (providerId) {
      const saved = savedWorkspaceIdByProvider[providerId];
      if (saved && workspaces.some((w) => w.id === saved)) return saved;
    }
    return workspaces.length > 0 ? workspaces[0].id : undefined;
  }, [workspaceId, providerId, savedWorkspaceIdByProvider, workspaces]);

  const { data: fetchedWorkspace } = useGetWorkspaceByIdQuery(effectiveWorkspaceId!, {
    skip: !effectiveWorkspaceId,
  });

  const currentWorkspace = useMemo(() => {
    if (effectiveWorkspaceId) {
      return (
        workspaces.find((w) => w.id === effectiveWorkspaceId) ?? fetchedWorkspace ?? null
      );
    }
    return null;
  }, [effectiveWorkspaceId, workspaces, fetchedWorkspace]);

  const selectedProvider = useMemo(() => {
    if (userSelectedProvider) return userSelectedProvider;
    if (providers.length > 0) return providers[0].id;
    return "claude-code";
  }, [userSelectedProvider, providers]);

  const selectedWorkspace = useMemo(() => {
    return effectiveWorkspaceId ?? "";
  }, [effectiveWorkspaceId]);

  return {
    workspaceId: effectiveWorkspaceId,
    workspaces,
    providers,
    selectedWorkspace,
    selectedProvider,
    currentWorkspace,
    setSelectedProvider,
  };
}
