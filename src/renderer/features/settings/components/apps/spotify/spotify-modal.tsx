import { useState, useReducer, useEffect, useCallback } from "react";

import {
  BodyMedium,
  Caption,
  Muted,
} from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSelectedReposQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} from "../../../../../lib/redux/api/connectionsApi";

//TODO: Fix flow

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SpotifyModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface SpotifyWizardData {
  accessToken: string;
  connectionId: string;
  selectedSources: string[];
  currentSources: any[];
  fromManage: boolean;
}

type StepId = "setToken" | "add" | "manage";

const ALL_SOURCES = [
  {
    id: "playlists",
    name: "Your Playlists",
    description: "Your saved and created playlists",
  },
  {
    id: "recently-played",
    name: "Recently Played",
    description: "Tracks you've recently listened to",
  },
  {
    id: "top-tracks",
    name: "Top Tracks",
    description: "Your most played tracks",
  },
  {
    id: "top-artists",
    name: "Top Artists",
    description: "Your most listened artists",
  },
  {
    id: "saved-albums",
    name: "Saved Albums",
    description: "Albums in your library",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Step: Loading
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading sources...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SpotifyWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();

  const handleSubmit = async () => {
    if (!data.accessToken?.trim()) {
      setErrors({ token: "Access token is required" });
      return;
    }

    setLoading(true);
    setErrors({ token: "" });

    try {
      const startTime = Date.now();

      const connectionResult = await getConnection("spotify").unwrap();

      if (!connectionResult.success) {
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "spotify",
        connectionId: connId,
        accessToken: data.accessToken,
      }).unwrap();

      onSuccess?.();

      setData({
        connectionId: connId,
        fromManage: false,
      });

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      goTo("add");
    } catch (err: any) {
      setErrors({
        token: err?.data?.error || err?.message || "Failed to save credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Spotify access token to connect your music library."
      fields={[
        {
          id: "access-token",
          label: "Access Token",
          placeholder: "BQD4ZoGLWj8...",
          value: data.accessToken || "",
          onChange: (value) => {
            setData({ accessToken: value });
            if (errors.token) setErrors({ token: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to get your access token:</strong>
          <br />
          1. Go to{" "}
          <a
            href="https://developer.spotify.com/console/get-current-user/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Spotify Developer Console
          </a>
          <br />
          2. Click &quot;Get Token&quot; and authorize the required scopes
          <br />
          3. Copy the OAuth Token and paste it here
          <br />
          <br />
          <strong>Required scopes:</strong>
          user-library-read, user-read-recently-played, user-top-read,
          playlist-read-private
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Sources
// ─────────────────────────────────────────────────────────────────────────────

function SelectSourcesStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SpotifyWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const selectedSources = data.selectedSources || [];

  const availableSources = ALL_SOURCES.filter(
    (s) => !data.currentSources?.some((r: any) => r.source === s.id),
  );

  const toggleSource = (sourceId: string | number) => {
    const id = String(sourceId);
    const next = selectedSources.includes(id)
      ? selectedSources.filter((s) => s !== id)
      : [...selectedSources, id];
    setData({ selectedSources: next });
  };

  const handleSave = async () => {
    if (selectedSources.length === 0) {
      setErrors({ sources: "Please select at least one source" });
      return;
    }

    setLoading(true);
    setErrors({ sources: "" });

    try {
      const startTime = Date.now();

      await saveResources({
        provider: "spotify",
        connectionId: data.connectionId,
        resources: selectedSources as any,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedRepos("spotify").unwrap();
        if (result.success) {
          setData({
            currentSources: result.repos || [],
            selectedSources: [],
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        sources: err?.data?.error || err?.message || "Failed to save sources",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) {
      goTo("manage");
    } else {
      goTo("setToken");
    }
  };

  return (
    <SelectResourcesStep
      resources={availableSources}
      selectedResources={selectedSources}
      onToggleResource={toggleSource}
      loading={loading}
      error={errors.sources || ""}
      onSave={handleSave}
      onBack={handleBack}
      title="Select which Spotify content you want to include in your feed."
      emptyMessage="All sources are already connected."
      saveButtonLabel={`Save ${selectedSources.length} Sources`}
      renderResourceItem={(source) => (
        <>
          <BodyMedium>{source.name}</BodyMedium>
          <Caption className="mt-0.5">{source.description}</Caption>
        </>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Sources
// ─────────────────────────────────────────────────────────────────────────────

function ManageSourcesStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SpotifyWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const handleRemove = async (sourceId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(sourceId).unwrap();
      const result = await getSelectedRepos("spotify").unwrap();
      if (result.success) {
        setData({ currentSources: result.repos || [] });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "Failed to remove source",
      });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const currentSourceIds = new Set(
        data.currentSources?.map((r: any) => r.source) || [],
      );

      const availableSources = ALL_SOURCES.filter(
        (s) => !currentSourceIds.has(s.id),
      );

      if (availableSources.length === 0) {
        setErrors({ manage: "All sources are already connected" });
        return;
      }

      setData({
        selectedSources: [],
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "Failed to load sources",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentSources || []}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="source"
      resourceLabelPlural="sources"
      addButtonLabel="Add Sources"
      revokeButtonLabel="Revoke Spotify Access"
      renderResourceItem={(source) => (
        <div className="flex-1">
          <BodyMedium>{source.name}</BodyMedium>
          <Caption className="mt-0.5">{source.source}</Caption>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

const SpotifyModal = ({
  open,
  onClose,
  isConnected,
  onSuccess,
}: SpotifyModalProps) => {
  type InitState = { initializing: boolean; step: StepId; data: Partial<SpotifyWizardData> };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, step: "setToken" as StepId, data: {} },
  );
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [getSelectedRepos] = useLazyGetSelectedReposQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, step: "setToken", data: {} });
      return;
    }

    const loadInitialData = async () => {
      const baseData: Partial<SpotifyWizardData> = {
        accessToken: "",
        selectedSources: [],
        currentSources: [],
        fromManage: false,
      };

      let finalStep: StepId = "setToken";
      let finalData: Partial<SpotifyWizardData> = baseData;

      if (isConnected) {
        try {
          const startTime = Date.now();
          const result = await getSelectedRepos("spotify").unwrap();

          if (result.success) {
            finalData = {
              ...baseData,
              connectionId: result.connectionId,
              currentSources: result.repos || [],
            };
            finalStep = "manage";
          }

          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (err) {
          console.error("[loadInitialData] Error:", err);
        }
      }

      setInitState({ initializing: false, step: finalStep, data: finalData });
    };

    loadInitialData();
  }, [open, isConnected, getSelectedRepos]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("spotify").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<SpotifyWizardData>[] = initState.initializing
    ? [{ id: "loading", render: () => <LoadingStep /> }]
    : [
        {
          id: "setToken",
          render: () => <TokenStep onSuccess={onSuccess} />,
        },
        {
          id: "add",
          render: () => <SelectSourcesStep onComplete={handleClose} />,
        },
        {
          id: "manage",
          render: () => (
            <ManageSourcesStep onRevoke={() => setShowRevokeConfirm(true)} />
          ),
        },
      ];

  return (
    <>
      <WizardModal
        key={`wizard-${initState.step}`}
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        steps={steps}
        initialStep={initState.initializing ? "loading" : initState.step}
        initialData={initState.data}
        title="Spotify"
        icon="connections/spotify.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Spotify"
        />
      )}
    </>
  );
};

export default SpotifyModal;
