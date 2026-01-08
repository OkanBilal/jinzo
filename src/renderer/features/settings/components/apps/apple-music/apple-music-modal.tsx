"use client";

import { useState, useEffect } from "react";

import { Caption, BodyMedium } from "../../../../../components/ui/text";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSelectedReposQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} from "../../../../../lib/redux/api/connectionsApi";
import {
  ConnectionModalWrapper,
  LoadingState,
} from "../shared/connection-modal-wrapper";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

type AppleMusicModalProps = {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
};

type Step = "setToken" | "add" | "manage";

const AppleMusicModal = ({
  open,
  onClose,
  isConnected,
  onSuccess,
}: AppleMusicModalProps) => {
  const [step, setStep] = useState<Step>("setToken");
  const [developerToken, setDeveloperToken] = useState("");
  const [userToken, setUserToken] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [currentResources, setCurrentResources] = useState<any[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [isFirstConnection, setIsFirstConnection] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials, { isLoading: isSavingCredentials }] =
    useSaveCredentialsMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();
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
    isRevokingConnection ||
    isProcessing;

  useEffect(() => {
    if (open) {
      setInitializing(true);
      if (isConnected && !isFirstConnection) {
        const startTime = Date.now();
        loadCurrentResources().finally(() => {
          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);

          setTimeout(() => {
            setInitializing(false);
          }, remainingTime);
        });
      } else {
        setStep("setToken");
        setInitializing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isConnected]);

  const handleClose = () => {
    setDeveloperToken("");
    setUserToken("");
    setSelectedResources([]);
    setCurrentResources([]);
    setConnectionId("");
    setError("");
    setStep("setToken");
    setInitializing(false);
    setIsFirstConnection(false);
    onClose();
  };

  const loadCurrentResources = async () => {
    try {
      const result = await getSelectedRepos("apple-music").unwrap();

      if (result.success) {
        setCurrentResources(result.repos || []);
        setConnectionId(result.connectionId);
        setStep("manage");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    }
  };

  const handleCredentialSubmit = async () => {
    if (!developerToken.trim() || !userToken.trim()) {
      setError("Both tokens are required");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const startTime = Date.now();

      const connectionResult = await getConnection("apple-music").unwrap();

      if (!connectionResult.success) {
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;
      setConnectionId(connId);

      await saveCredentials({
        provider: "apple-music",
        connectionId: connId,
        developerToken,
        userToken,
      }).unwrap();

      setIsFirstConnection(true);
      onSuccess?.();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setStep("add");
    } catch (error: any) {
      setError(
        error?.data?.error || error.message || "Failed to save credentials"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveResources = async () => {
    if (selectedResources.length === 0) {
      setError("Please select at least one resource");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const startTime = Date.now();

      await saveResources({
        provider: "apple-music",
        connectionId,
        resources: selectedResources as any,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (isConnected) {
        setSelectedResources([]);
        await loadCurrentResources();
        setStep("manage");
      } else {
        handleClose();
      }
    } catch (error: any) {
      setError(
        error?.data?.error || error.message || "Failed to save resources"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveResource = async (resourceId: string) => {
    setError("");

    try {
      await deleteResource(resourceId).unwrap();
      await loadCurrentResources();
    } catch (err: any) {
      setError(err?.data?.error || err.message || "Failed to remove resource");
    }
  };

  const handleRevokeCredential = async () => {
    setShowRevokeConfirm(true);
  };

  const confirmRevoke = async () => {
    setError("");
    setShowRevokeConfirm(false);

    try {
      await revokeConnection("apple-music").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || "Failed to disconnect");
    }
  };

  const toggleResource = (resource: string | number) => {
    const res = String(resource);
    setSelectedResources((prev) =>
      prev.includes(res) ? prev.filter((r) => r !== res) : [...prev, res]
    );
  };

  const handleAddNewResources = async () => {
    setError("");
    setIsProcessing(true);

    try {
      const currentResourceIds = new Set(
        currentResources.map((r: any) => r.source)
      );

      setSelectedResources(Array.from(currentResourceIds));

      setStep("add");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ConnectionModalWrapper
      open={open}
      onClose={handleClose}
      appName="Apple Music"
      appIcon="/apps/apple-music-skeuomorphic.png"
    >
      {initializing ? (
        <LoadingState message="Loading sources..." />
      ) : step === "setToken" ? (
        <CredentialStep
          description="Enter your Apple Music API credentials to connect your music library."
          fields={[
            {
              id: "developer-token",
              label: "Developer Token",
              placeholder: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
              value: developerToken,
              onChange: setDeveloperToken,
            },
            {
              id: "user-token",
              label: "Music User Token",
              placeholder: "AqBi2v3...",
              value: userToken,
              onChange: setUserToken,
            },
          ]}
          instructions={
            <>
              <strong>How to get your tokens:</strong>
              <br />
              1. Developer Token: Create a JWT token from Apple Developer Portal
              <br />
              2. Music User Token: Obtain from Apple Music Kit JS authentication
            </>
          }
          onSubmit={handleCredentialSubmit}
          loading={loading}
          error={error}
        />
      ) : step === "add" ? (
        <SelectResourcesStep
          resources={(() => {
            const allSources = [
              {
                id: "playlists",
                name: "Library Playlists",
                description: "Your saved playlists",
              },
              {
                id: "recently-played",
                name: "Recently Played",
                description: "Tracks you've recently listened to",
              },
              {
                id: "heavy-rotation",
                name: "Heavy Rotation",
                description: "Your most played songs and albums",
              },
            ];
            const existingIds = new Set(
              currentResources.map((r: any) => r.source)
            );
            return allSources.filter((s) => !existingIds.has(s.id));
          })()}
          selectedResources={selectedResources}
          onToggleResource={toggleResource}
          loading={loading}
          error={error}
          onSave={handleSaveResources}
          onBack={() => setStep(isConnected ? "manage" : "setToken")}
          title="Select which Apple Music content you want to include in your feed."
          emptyMessage="All sources are already connected."
          saveButtonLabel={`Save ${selectedResources.length} Resources`}
          renderResourceItem={(source) => (
            <>
              <BodyMedium>{source.name}</BodyMedium>
              <Caption className="mt-0.5">{source.description}</Caption>
            </>
          )}
        />
      ) : (
        <ManageResourcesStep
          resources={currentResources}
          onAddNew={handleAddNewResources}
          onRemove={handleRemoveResource}
          onRevoke={handleRevokeCredential}
          loading={loading}
          error={error}
          resourceLabel="source"
          resourceLabelPlural="sources"
          addButtonLabel="Add Resources"
          revokeButtonLabel="Revoke Apple Music Access"
          renderResourceItem={(resource) => (
            <div className="flex-1">
              <BodyMedium>{resource.name}</BodyMedium>
              <Caption className="mt-0.5">{resource.source}</Caption>
            </div>
          )}
        />
      )}

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={confirmRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={loading}
          appName="Apple Music"
        />
      )}
    </ConnectionModalWrapper>
  );
};

export default AppleMusicModal;
