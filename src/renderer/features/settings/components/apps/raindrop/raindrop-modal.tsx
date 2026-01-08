"use client";

import { useState, useEffect, useCallback } from "react";

import { Caption, BodyMedium } from "../../../../../components/ui/text";
import {
  ConnectionModalWrapper,
  LoadingState,
  RevokeConfirmModal,
  ManageResourcesStep,
  SelectResourcesStep,
  CredentialStep,
} from "../shared";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetRaindropCollectionsQuery,
  useLazyGetSelectedCollectionsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type RaindropCollection,
  type SelectedCollection,
} from "../../../../../lib/redux/api";

interface RaindropModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
}

type Step = "tokenSet" | "add" | "manage";

export default function RaindropModal({
  open,
  onClose,
  isConnected,
}: RaindropModalProps) {
  const [step, setStep] = useState<Step>("tokenSet");
  const [token, setToken] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [collections, setCollections] = useState<RaindropCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<Set<number>>(
    new Set()
  );
  const [currentCollections, setCurrentCollections] = useState<
    SelectedCollection[]
  >([]);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);

  // RTK Query hooks
  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials, { isLoading: isSavingCredentials }] =
    useSaveCredentialsMutation();
  const [getRaindropCollections, { isLoading: isLoadingCollections }] =
    useLazyGetRaindropCollectionsQuery();
  const [getSelectedCollections] = useLazyGetSelectedCollectionsQuery();
  const [saveResources, { isLoading: isSavingResources }] =
    useSaveResourcesMutation();
  const [deleteResource, { isLoading: isDeletingResource }] =
    useDeleteResourceMutation();
  const [revokeConnection, { isLoading: isRevokingConnection }] =
    useRevokeConnectionMutation();

  const loading =
    isSavingCredentials ||
    isLoadingCollections ||
    isSavingResources ||
    isDeletingResource ||
    isRevokingConnection;

  const loadSelectedCollections = useCallback(async () => {
    try {
      const result = await getSelectedCollections("raindrop").unwrap();

      if (result.success) {
        setCurrentCollections(result.collections || []);
        setConnectionId(result.connectionId);
        setStep("manage");
      }
    } catch (err: any) {
      setError(err?.data?.error || "Failed to load collections");
    }
  }, [getSelectedCollections]);

  useEffect(() => {
    if (open) {
      setInitializing(true);
      if (isConnected) {
        const startTime = Date.now();
        loadSelectedCollections().finally(() => {
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
  }, [open, isConnected, loadSelectedCollections]);

  const handleClose = () => {
    setToken("");
    setConnectionId("");
    setCollections([]);
    setSelectedCollections(new Set());
    setCurrentCollections([]);
    setError("");
    setStep("tokenSet");
    setInitializing(false);
    onClose();
  };

  const handleTokenSubmit = async () => {
    if (!token.trim()) {
      setError("Please enter a valid token");
      return;
    }

    setError("");

    try {
      const connResult = await getConnection("raindrop").unwrap();

      if (!connResult.success || !connResult.connection) {
        throw new Error("Failed to get connection");
      }

      const id = connResult.connection.id;
      setConnectionId(id);

      await saveCredentials({
        provider: "raindrop",
        connectionId: id,
        token,
      }).unwrap();

      const collectionsResult = await getRaindropCollections(id).unwrap();

      if (!collectionsResult.success) {
        throw new Error("Failed to fetch collections");
      }

      setCollections(collectionsResult.collections);
      setStep("add");
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const toggleCollection = (collectionId: number) => {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  };

  const handleSaveCollections = async () => {
    if (selectedCollections.size === 0) {
      setError("Please select at least one collection");
      return;
    }

    setError("");

    try {
      const selectedCollectionObjects = collections.filter((col) =>
        selectedCollections.has(col.id)
      );

      await saveResources({
        provider: "raindrop",
        connectionId,
        resources: selectedCollectionObjects,
      }).unwrap();

      if (isConnected) {
        setSelectedCollections(new Set());
        await loadSelectedCollections();
        setStep("manage");
      } else {
        handleClose();
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRemoveCollection = async (collectionId: string) => {
    setError("");

    try {
      await deleteResource(collectionId).unwrap();
      await loadSelectedCollections();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleRevokeToken = async () => {
    setError("");

    try {
      await revokeConnection("raindrop").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const handleAddNewCollections = async () => {
    setError("");

    try {
      const result = await getRaindropCollections(connectionId).unwrap();

      if (!result.success) {
        throw new Error("Failed to fetch collections");
      }

      const currentCollectionIds = new Set(
        currentCollections.map((c) => c.externalId)
      );
      const availableCollections = result.collections.filter(
        (col) => !currentCollectionIds.has(String(col.id))
      );

      if (availableCollections.length === 0) {
        setError("All collections are already connected");
        return;
      }

      setCollections(availableCollections);
      setStep("add");
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "An error occurred");
    }
  };

  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const handleRevokeClick = () => {
    setShowRevokeConfirm(true);
  };

  const confirmRevoke = async () => {
    setShowRevokeConfirm(false);
    await handleRevokeToken();
  };

  return (
    <ConnectionModalWrapper
      open={open}
      onClose={handleClose}
      appName="Raindrop"
      appIcon="/apps/raindrop-skeuomorphic.png"
    >
      {initializing ? (
        <LoadingState message="Loading collections..." />
      ) : step === "tokenSet" ? (
        <CredentialStep
          description="Enter your Raindrop.io API Token to connect your collections."
          fields={[
            {
              id: "raindrop-token",
              label: "API Token",
              placeholder: "Enter your Raindrop API token",
              value: token,
              onChange: setToken,
            },
          ]}
          instructions={
            <>
              <strong>How to get your API token:</strong>
              <br />
              1. Go to Raindrop.io Settings → Integrations
              <br />
              2. Find &quot;For Developers&quot; section
              <br />
              3. Click &quot;Create new app&quot; or use existing one
              <br />
              4. Copy the &quot;Test token&quot;
            </>
          }
          onSubmit={handleTokenSubmit}
          loading={loading}
          error={error}
        />
      ) : step === "manage" ? (
        <ManageResourcesStep
          resources={currentCollections}
          onAddNew={handleAddNewCollections}
          onRemove={handleRemoveCollection}
          onRevoke={handleRevokeClick}
          loading={loading}
          error={error}
          resourceLabel="collection"
          resourceLabelPlural="collections"
          addButtonLabel="Add Collection"
          revokeButtonLabel="Revoke Raindrop Access"
          renderResourceItem={(collection) => (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BodyMedium>{collection.name}</BodyMedium>
                {collection.metadata?.count !== undefined && (
                  <Caption>({collection.metadata.count} items)</Caption>
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <SelectResourcesStep
          resources={collections.map((col) => ({ ...col, id: String(col.id) }))}
          selectedResources={Array.from(selectedCollections).map(String)}
          onToggleResource={(id) => toggleCollection(Number(id))}
          onSave={handleSaveCollections}
          onBack={() => setStep(isConnected ? "manage" : "tokenSet")}
          loading={loading}
          error={error}
          title="Select the collections you want to connect."
          saveButtonLabel={`Save ${selectedCollections.size} Collections`}
          renderResourceItem={(collection) => (
            <div className="flex items-center gap-2">
              <BodyMedium>{collection.title}</BodyMedium>
              <Caption>({collection.count} items)</Caption>
            </div>
          )}
        />
      )}

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={confirmRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={loading}
          appName="Raindrop"
          description="Are you sure you want to revoke Raindrop access? This will disconnect all collections."
        />
      )}
    </ConnectionModalWrapper>
  );
}
