import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import type { Workspace, Provider } from "../types";

export function useWorkspaceData() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>("copilot_cli");
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Load workspaces and providers on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [workspacesRes, providersRes] = await Promise.all([
          window.api.workspaces.getAll(),
          window.api.providers.getByKind("agent_runtime"),
        ]);

        if (workspacesRes.success && workspacesRes.data) {
          setWorkspaces(workspacesRes.data);
        }

        if (providersRes.success && providersRes.data) {
          const enabled = providersRes.data.filter(
            (p: Provider) => p.isEnabled,
          );
          setProviders(enabled);
          if (enabled.length > 0) {
            setSelectedProvider(enabled[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    }

    loadData();
  }, []);

  // When workspaceId changes from URL, update selected workspace details
  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspace(workspaceId);

      // Find and set the current workspace details
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (ws) {
        setCurrentWorkspace(ws);
      } else {
        // Fetch the workspace if not in list yet
        window.api.workspaces.getById(workspaceId).then((res) => {
          if (res.success && res.data) {
            setCurrentWorkspace(res.data);
          }
        });
      }
    } else if (workspaces.length > 0) {
      // Default to first workspace if none selected
      setSelectedWorkspace(workspaces[0].id);
      setCurrentWorkspace(workspaces[0]);
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
