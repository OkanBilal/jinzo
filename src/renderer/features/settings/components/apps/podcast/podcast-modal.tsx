import { useState, useEffect, useCallback } from "react";

import {
  BodyMedium,
  Body,
  Muted,
  ErrorText,
} from "../../../../../components/ui/text";
import {
  ConnectionModalWrapper,
  LoadingState,
  RevokeConfirmModal,
  ManageResourcesStep,
  CredentialStep,
} from "../shared";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSelectedPodcastsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type SelectedPodcast,
} from "../../../../../lib/redux/api";
import {
  PrimaryButton,
  LinkButton,
  DangerButton,
} from "../../../../../components/ui/button";

interface PodcastModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
}

type Step = "tokenSet" | "add" | "manage";

export default function PodcastModal({
  open,
  onClose,
  isConnected,
}: PodcastModalProps) {
  const [step, setStep] = useState<Step>("tokenSet");
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [podcastName, setPodcastName] = useState("");
  const [podcastsToAdd, setPodcastsToAdd] = useState<string[]>([]);
  const [currentPodcasts, setCurrentPodcasts] = useState<SelectedPodcast[]>([]);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  // RTK Query hooks
  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials, { isLoading: isSavingCredentials }] =
    useSaveCredentialsMutation();
  const [getSelectedPodcasts] = useLazyGetSelectedPodcastsQuery();
  const [saveResources, { isLoading: isSavingResources }] =
    useSaveResourcesMutation();
  const [deleteResource, { isLoading: isDeletingResource }] =
    useDeleteResourceMutation();
  const [revokeConnection, { isLoading: isRevokingConnection }] =
    useRevokeConnectionMutation();

  const loading =
    isSavingCredentials ||
    isSavingResources ||
    isDeletingResource ||
    isRevokingConnection;

  const loadSelectedPodcasts = useCallback(async () => {
    try {
      const result = await getSelectedPodcasts("podcast").unwrap();

      if (result.success) {
        setCurrentPodcasts(result.podcasts || []);
        setConnectionId(result.connectionId);
        setStep("manage");
      }
    } catch (err: any) {
      setError(err?.data?.error || "Failed to load podcasts");
    }
  }, [getSelectedPodcasts]);

  useEffect(() => {
    if (open) {
      setInitializing(true);
      if (isConnected) {
        const startTime = Date.now();
        loadSelectedPodcasts().finally(() => {
          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);

          setTimeout(() => {
            setInitializing(false);
          }, remainingTime);
        });
      } else {
        setStep("tokenSet");
        setInitializing(false);
      }
    }
  }, [open, isConnected, loadSelectedPodcasts]);

  if (!open) return null;

  const handleClose = () => {
    setApiKey("");
    setUserId("");
    setConnectionId("");
    setPodcastName("");
    setPodcastsToAdd([]);
    setCurrentPodcasts([]);
    setError("");
    setStep("tokenSet");
    setInitializing(false);
    setShowRevokeConfirm(false);
    onClose();
  };

  const handleCredentialsSubmit = async () => {
    if (!apiKey?.trim() || !userId?.trim()) {
      setError("Please enter both API Key and User ID");
      return;
    }

    setError("");

    try {
      const connResult = await getConnection("podcast").unwrap();

      if (!connResult.success || !connResult.connection) {
        throw new Error("Failed to get connection");
      }

      const connId = connResult.connection.id;
      setConnectionId(connId);

      await saveCredentials({
        provider: "podcast",
        connectionId: connId,
        apiKey,
        userId,
      }).unwrap();

      setStep("add");
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleAddPodcast = () => {
    if (!podcastName.trim()) {
      setError("Please enter a podcast name");
      return;
    }

    if (podcastsToAdd.includes(podcastName.trim())) {
      setError("This podcast is already in the list");
      return;
    }

    setPodcastsToAdd([...podcastsToAdd, podcastName.trim()]);
    setPodcastName("");
    setError("");
  };

  const handleRemovePodcastFromList = (name: string) => {
    setPodcastsToAdd(podcastsToAdd.filter((p) => p !== name));
  };

  const handleSavePodcasts = async () => {
    if (podcastsToAdd.length === 0) {
      setError("Please add at least one podcast");
      return;
    }

    setError("");

    try {
      const podcasts = podcastsToAdd.map((name) => ({ name }));

      await saveResources({
        provider: "podcast",
        connectionId,
        resources: podcasts,
      }).unwrap();

      if (isConnected) {
        setPodcastsToAdd([]);
        await loadSelectedPodcasts();
        setStep("manage");
      } else {
        handleClose();
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRemovePodcast = async (podcastId: string) => {
    setError("");

    try {
      await deleteResource(podcastId).unwrap();
      await loadSelectedPodcasts();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRevokeCredentials = async () => {
    setShowRevokeConfirm(false);
    setError("");

    try {
      await revokeConnection("podcast").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleAddNewPodcasts = () => {
    setStep("add");
  };

  return (
    <>
      <ConnectionModalWrapper
        open={open}
        onClose={handleClose}
        appName="Podcast Connection"
        appIcon="/apps/podcast-skeuomorphic.png"
      >
        {initializing ? (
          <LoadingState message="Loading podcasts..." />
        ) : step === "tokenSet" ? (
          <CredentialStep
            description="Enter your Taddy.org API credentials to connect your podcasts."
            fields={[
              {
                id: "podcast-api-key",
                label: "API Key",
                placeholder: "Your Taddy API Key",
                value: apiKey,
                onChange: setApiKey,
              },
              {
                id: "podcast-user-id",
                label: "User ID",
                placeholder: "Your Taddy User ID",
                value: userId,
                onChange: setUserId,
              },
            ]}
            instructions={
              <>
                <strong>How to get your credentials:</strong>
                <br />
                1. Go to{" "}
                <a
                  href="https://taddy.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 underline"
                >
                  taddy.org
                </a>
                <br />
                2. Sign in and go to API settings
                <br />
                3. Copy your API Key and User ID
              </>
            }
            onSubmit={handleCredentialsSubmit}
            loading={loading}
            error={error}
            submitLabel="Continue"
            loadingLabel="Connecting..."
          />
        ) : step === "manage" ? (
          <ManageResourcesStep
            resources={currentPodcasts}
            onAddNew={handleAddNewPodcasts}
            onRemove={handleRemovePodcast}
            onRevoke={() => setShowRevokeConfirm(true)}
            loading={loading}
            error={error}
            resourceLabel="podcast"
            resourceLabelPlural="podcasts"
            addButtonLabel="Add Podcast"
            renderResourceItem={(resource) => (
              <div className="flex-1">
                <BodyMedium>{resource.name}</BodyMedium>
              </div>
            )}
          />
        ) : (
          <PodcastsStep
            podcastName={podcastName}
            podcastsToAdd={podcastsToAdd}
            onPodcastNameChange={setPodcastName}
            onAddPodcast={handleAddPodcast}
            onRemovePodcast={handleRemovePodcastFromList}
            onSave={handleSavePodcasts}
            onBack={() => setStep(isConnected ? "manage" : "tokenSet")}
            loading={loading}
            error={error}
          />
        )}
      </ConnectionModalWrapper>

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevokeCredentials}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={loading}
          appName="Podcast"
          description="This will disconnect all podcasts."
        />
      )}
    </>
  );
}

interface PodcastsStepProps {
  podcastName: string;
  podcastsToAdd: string[];
  onPodcastNameChange: (value: string) => void;
  onAddPodcast: () => void;
  onRemovePodcast: (name: string) => void;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
}

function PodcastsStep({
  podcastName,
  podcastsToAdd,
  onPodcastNameChange,
  onAddPodcast,
  onRemovePodcast,
  onSave,
  onBack,
  loading,
  error,
}: PodcastsStepProps) {
  return (
    <div className="space-y-4">
      <Muted>
        Add podcasts you want to follow. {podcastsToAdd.length} added.
      </Muted>

      <div className="flex gap-2">
        <input
          type="text"
          value={podcastName}
          onChange={(e) => onPodcastNameChange(e.target.value)}
          placeholder="Enter podcast name"
          className="flex-1 px-3 py-2.5 bg-white dark:bg-primary-100 rounded-xl text-primary-900 dark:text-primary-900 placeholder:text-primary-400 dark:placeholder:text-primary-600 focus:outline-none"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAddPodcast();
          }}
        />
        <PrimaryButton
          onClick={onAddPodcast}
          disabled={loading || !podcastName.trim()}
        >
          Add
        </PrimaryButton>
      </div>

      {podcastsToAdd.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
          {podcastsToAdd.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
            >
              <Body>{name}</Body>
              <DangerButton
                onClick={() => onRemovePodcast(name)}
                disabled={loading}
                className=""
              >
                Remove
              </DangerButton>
            </div>
          ))}
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <LinkButton onClick={onBack} disabled={loading} className="px-1">
          Back
        </LinkButton>
        <PrimaryButton
          onClick={onSave}
          disabled={loading || podcastsToAdd.length === 0}
          isLoading={loading}
          className="ml-auto"
        >
          {loading ? "Saving..." : `Finish (${podcastsToAdd.length} Podcasts)`}
        </PrimaryButton>
      </div>
    </div>
  );
}
