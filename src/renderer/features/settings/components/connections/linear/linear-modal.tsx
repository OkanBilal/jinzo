import { useState } from "react";

import { Body, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetLinearTeamsQuery,
  useLazyGetSelectedTeamsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  type LinearTeam,
  type SelectedTeam,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";
import { AutoSyncSection } from "../shared/auto-sync-section";
import { useConnectionModalState } from "../shared/use-connection-modal-state";
import { ConnectionLoadingStep } from "../shared/connection-loading-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LinearModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface LinearWizardData {
  apiKey: string;
  connectionId: string;
  teams: LinearTeam[];
  selectedTeams: Set<string>;
  currentTeams: SelectedTeam[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<LinearWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getLinearTeams] = useLazyGetLinearTeamsQuery();

  const handleSubmit = async () => {
    if (!data.apiKey?.trim()) {
      setErrors({ apiKey: "Please enter a valid API key" });
      return;
    }

    setLoading(true);
    setErrors({ apiKey: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("linear").unwrap();

      if (!connectionResult.success) {
        console.error("[Linear] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "linear",
        connectionId: connId,
        apiKey: data.apiKey,
      }).unwrap();

      onSuccess?.();

      const teamsResult = await getLinearTeams(connId).unwrap();

      if (!teamsResult.success) {
        console.error("[Linear] Failed to fetch teams:", teamsResult);
        throw new Error("Failed to fetch teams");
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setData({
        connectionId: connId,
        teams: teamsResult.teams,
        isFirstConnection: true,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      console.error("[Linear] Error in credential submit:", err);

      let errorMessage =
        "Failed to connect to Linear. Please check your API key.";

      if (err?.status === "CUSTOM_ERROR") {
        errorMessage = err?.error || errorMessage;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err?.data?.error) {
        errorMessage = err.data.error;
      } else if (err?.data?.message) {
        errorMessage = err.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setErrors({ apiKey: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Linear API key to connect your teams and sync issues."
      fields={[
        {
          id: "linear-api-key",
          label: "API Key",
          placeholder: "lin_api_xxxxxxxxxxxxxxxxxxxx",
          value: data.apiKey || "",
          onChange: (value) => {
            setData({ apiKey: value });
            if (errors.apiKey) setErrors({ apiKey: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to create an API key:</strong>
          <br />
          1. Go to Linear Settings → API →{" "}
          <a
            href="https://linear.app/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Personal API keys
          </a>
          <br />
          2. Click &quot;Create key&quot;
          <br />
          3. Give it a name and copy the key
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.apiKey || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Teams
// ─────────────────────────────────────────────────────────────────────────────

function SelectTeamsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<LinearWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedTeams] = useLazyGetSelectedTeamsQuery();

  const selectedTeams = data.selectedTeams || new Set<string>();

  const toggleTeam = (teamKey: string | number) => {
    const key = String(teamKey);
    const next = new Set(selectedTeams);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setData({ selectedTeams: next });
  };

  const handleSave = async () => {
    if (selectedTeams.size === 0) {
      setErrors({ teams: "Please select at least one team" });
      return;
    }

    setLoading(true);
    setErrors({ teams: "" });

    try {
      const startTime = Date.now();

      const selectedTeamObjects = data.teams.filter((team) =>
        selectedTeams.has(team.key)
      );

      await saveResources({
        provider: "linear",
        connectionId: data.connectionId,
        resources: selectedTeamObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedTeams("linear").unwrap();
        if (result.success) {
          setData({
            currentTeams: result.teams,
            selectedTeams: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        teams: err?.data?.error || err.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) {
      goTo("manage");
    } else if (data.isFirstConnection) {
      onComplete();
    } else {
      goTo("setToken");
    }
  };

  return (
    <SelectResourcesStep
      resources={data.teams.map((team) => ({ ...team, id: team.key }))}
      selectedResources={selectedTeams}
      onToggleResource={toggleTeam}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.teams || ""}
      title="Select the teams you want to sync issues from."
      saveButtonLabel={`Save ${selectedTeams.size} Teams`}
      renderResourceItem={(team) => (
        <div className="flex items-center gap-2">
          <Body>{team.name}</Body>
          {team.description && (
            <span className="text-xs text-primary-500 truncate max-w-50">
              {team.description}
            </span>
          )}
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Teams
// ─────────────────────────────────────────────────────────────────────────────

function ManageTeamsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<LinearWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getLinearTeams] = useLazyGetLinearTeamsQuery();
  const [getSelectedTeams] = useLazyGetSelectedTeamsQuery();

  const handleRemove = async (teamId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(teamId).unwrap();
      const result = await getSelectedTeams("linear").unwrap();
      if (result.success) {
        setData({ currentTeams: result.teams });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err.message || "An error occurred",
      });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const teamsResult = await getLinearTeams(data.connectionId).unwrap();

      if (!teamsResult.success) {
        throw new Error("Failed to fetch teams");
      }

      const currentTeamKeys = new Set(data.currentTeams.map((t) => t.key));
      const availableTeams = teamsResult.teams.filter(
        (team: LinearTeam) => !currentTeamKeys.has(team.key)
      );

      if (availableTeams.length === 0) {
        setErrors({ manage: "All teams are already connected" });
        return;
      }

      setData({
        teams: availableTeams,
        selectedTeams: new Set(),
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentTeams.map((t) => ({
        ...t,
        fullName: t.name,
      }))}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="team"
      resourceLabelPlural="teams"
      addButtonLabel="Add Team"
      revokeButtonLabel="Revoke Linear Access"
      extraContent={<AutoSyncSection provider="linear" providerLabel="Linear" />}
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.name}</Body>
          </div>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function LinearModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: LinearModalProps) {
  const [getSelectedTeams] = useLazyGetSelectedTeamsQuery();

  const { initState, showRevokeConfirm, setShowRevokeConfirm, handleClose, handleRevoke, isRevoking } =
    useConnectionModalState<LinearWizardData>({
      open,
      onClose,
      isConnected,
      provider: "linear",
      appName: "Linear",
      baseData: {
        apiKey: "",
        teams: [],
        selectedTeams: new Set(),
        currentTeams: [],
        isFirstConnection: false,
        fromManage: false,
      },
      fetchSelected: async () => {
        const result = await getSelectedTeams("linear").unwrap();
        if (!result.success) return null;
        return { connectionId: result.connectionId, currentTeams: result.teams };
      },
    });

  const steps: WizardStep<LinearWizardData>[] = [
    {
      id: "loading",
      render: () => (
        <ConnectionLoadingStep
          targetStep={initState.targetStep}
          message="Loading teams..."
        />
      ),
    },
    {
      id: "setToken",
      render: () => <TokenStep onSuccess={onSuccess} />,
    },
    {
      id: "add",
      render: () => <SelectTeamsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => <ManageTeamsStep onRevoke={() => setShowRevokeConfirm(true)} />,
    },
  ];

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        steps={steps}
        initialStep="loading"
        initialData={initState.data}
        title="Linear"
        icon="connections/linear.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Linear"
          description="This will disconnect all teams and remove all Linear data. This action cannot be undone."
        />
      )}
    </>
  );
}
