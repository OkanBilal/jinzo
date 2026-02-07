import { useState, useEffect, useCallback } from "react";

import { Caption, BodyMedium, Muted } from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
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
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RaindropModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
}

interface RaindropWizardData {
  token: string;
  connectionId: string;
  collections: RaindropCollection[];
  selectedCollections: Set<number>;
  currentCollections: SelectedCollection[];
  fromManage: boolean;
}

type StepId = "loading" | "tokenSet" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep() {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<RaindropWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getRaindropCollections] = useLazyGetRaindropCollectionsQuery();

  const handleSubmit = async () => {
    if (!data.token?.trim()) {
      setErrors({ token: "Please enter a valid token" });
      return;
    }

    setLoading(true);
    setErrors({ token: "" });

    try {
      const connResult = await getConnection("raindrop").unwrap();

      if (!connResult.success || !connResult.connection) {
        throw new Error("Failed to get connection");
      }

      const id = connResult.connection.id;

      await saveCredentials({
        provider: "raindrop",
        connectionId: id,
        token: data.token,
      }).unwrap();

      const collectionsResult = await getRaindropCollections(id).unwrap();

      if (!collectionsResult.success) {
        throw new Error("Failed to fetch collections");
      }

      setData({
        connectionId: id,
        collections: collectionsResult.collections,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      setErrors({
        token: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Raindrop.io API Token to connect your collections."
      fields={[
        {
          id: "raindrop-token",
          label: "API Token",
          placeholder: "Enter your Raindrop API token",
          value: data.token || "",
          onChange: (value) => {
            setData({ token: value });
            if (errors.token) setErrors({ token: "" });
          },
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
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Collections
// ─────────────────────────────────────────────────────────────────────────────

function SelectCollectionsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<RaindropWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedCollections] = useLazyGetSelectedCollectionsQuery();

  const selectedCollections = data.selectedCollections || new Set<number>();

  const toggleCollection = (collectionId: number | string) => {
    const id = Number(collectionId);
    const next = new Set(selectedCollections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setData({ selectedCollections: next });
  };

  const handleSave = async () => {
    if (selectedCollections.size === 0) {
      setErrors({ collections: "Please select at least one collection" });
      return;
    }

    setLoading(true);
    setErrors({ collections: "" });

    try {
      const selectedCollectionObjects = data.collections.filter((col) =>
        selectedCollections.has(col.id)
      );

      await saveResources({
        provider: "raindrop",
        connectionId: data.connectionId,
        resources: selectedCollectionObjects,
      }).unwrap();

      if (data.fromManage) {
        const result = await getSelectedCollections("raindrop").unwrap();
        if (result.success) {
          setData({
            currentCollections: result.collections || [],
            selectedCollections: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        collections: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) {
      goTo("manage");
    } else {
      goTo("tokenSet");
    }
  };

  return (
    <SelectResourcesStep
      resources={data.collections.map((col) => ({ ...col, id: String(col.id) }))}
      selectedResources={Array.from(selectedCollections).map(String)}
      onToggleResource={(id) => toggleCollection(Number(id))}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.collections || ""}
      title="Select the collections you want to connect."
      saveButtonLabel={`Save ${selectedCollections.size} Collections`}
      renderResourceItem={(collection) => (
        <div className="flex items-center gap-2">
          <BodyMedium>{collection.title}</BodyMedium>
          <Caption>({collection.count} items)</Caption>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Collections
// ─────────────────────────────────────────────────────────────────────────────

function ManageCollectionsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<RaindropWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getRaindropCollections] = useLazyGetRaindropCollectionsQuery();
  const [getSelectedCollections] = useLazyGetSelectedCollectionsQuery();

  const handleRemove = async (collectionId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(collectionId).unwrap();
      const result = await getSelectedCollections("raindrop").unwrap();
      if (result.success) {
        setData({ currentCollections: result.collections || [] });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "An error occurred",
      });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const result = await getRaindropCollections(data.connectionId).unwrap();

      if (!result.success) {
        throw new Error("Failed to fetch collections");
      }

      const currentCollectionIds = new Set(
        data.currentCollections.map((c) => c.externalId)
      );
      const availableCollections = result.collections.filter(
        (col: RaindropCollection) => !currentCollectionIds.has(String(col.id))
      );

      if (availableCollections.length === 0) {
        setErrors({ manage: "All collections are already connected" });
        return;
      }

      setData({
        collections: availableCollections,
        selectedCollections: new Set(),
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentCollections}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<RaindropWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading collections...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function RaindropModal({
  open,
  onClose,
  isConnected,
}: RaindropModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initialData, setInitialData] = useState<Partial<RaindropWizardData>>({});
  const [targetStep, setTargetStep] = useState<StepId | null>(null);

  const [getSelectedCollections] = useLazyGetSelectedCollectionsQuery();
  const [getConnection] = useLazyGetConnectionQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  // Track if we've already initialized to prevent re-initialization when isConnected changes
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setInitializing(true);
      setTargetStep(null);
      setHasInitialized(false);
      return;
    }

    // Don't re-initialize if already done (e.g., when isConnected changes after token save)
    if (hasInitialized) {
      return;
    }

    const loadInitialData = async () => {
      setInitializing(true);
      setTargetStep(null);

      const baseData: Partial<RaindropWizardData> = {
        token: "",
        collections: [],
        selectedCollections: new Set(),
        currentCollections: [],
        fromManage: false,
      };

      if (!isConnected) {
        setInitialData(baseData);
        setTargetStep("tokenSet");
        setInitializing(false);
        setHasInitialized(true);
        return;
      }

      let finalStep: StepId = "tokenSet";
      let finalData: Partial<RaindropWizardData> = baseData;

      try {
        const startTime = Date.now();
        const result = await getSelectedCollections("raindrop").unwrap();

        if (result.success) {
          finalData = {
            ...baseData,
            connectionId: result.connectionId,
            currentCollections: result.collections || [],
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

      setInitialData(finalData);
      setTargetStep(finalStep);
      setInitializing(false);
      setHasInitialized(true);
    };

    loadInitialData();
  }, [open, isConnected, getSelectedCollections, getConnection, hasInitialized]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("raindrop").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<RaindropWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={targetStep} />,
    },
    {
      id: "tokenSet",
      render: () => <TokenStep />,
    },
    {
      id: "add",
      render: () => <SelectCollectionsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageCollectionsStep onRevoke={() => setShowRevokeConfirm(true)} />
      ),
    },
  ];

  return (
    <>
      <WizardModal
        open={open}
        onOpenChange={(isOpen) => !isOpen && handleClose()}
        steps={steps}
        initialStep="loading"
        initialData={initialData}
        title="Raindrop"
        icon="connections/raindrop.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Raindrop"
          description="Are you sure you want to revoke Raindrop access? This will disconnect all collections."
        />
      )}
    </>
  );
}
