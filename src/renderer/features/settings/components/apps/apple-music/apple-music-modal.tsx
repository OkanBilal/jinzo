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
  useLazyGetSelectedReposQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
} from "../../../../../lib/redux/api/connectionsApi";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AppleMusicModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface AppleMusicWizardData {
  developerToken: string;
  userToken: string;
  connectionId: string;
  selectedResources: string[];
  currentResources: any[];
  fromManage: boolean;
}

type StepId = "loading" | "setToken" | "add" | "manage";

const ALL_SOURCES = [
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

// ─────────────────────────────────────────────────────────────────────────────
// Step: Loading
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<AppleMusicWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

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
    useWizard<AppleMusicWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();

  const handleSubmit = async () => {
    if (!data.developerToken?.trim() || !data.userToken?.trim()) {
      setErrors({ token: "Both tokens are required" });
      return;
    }

    setLoading(true);
    setErrors({ token: "" });

    try {
      const startTime = Date.now();

      const connectionResult = await getConnection("apple-music").unwrap();

      if (!connectionResult.success) {
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "apple-music",
        connectionId: connId,
        developerToken: data.developerToken,
        userToken: data.userToken,
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
      description="Enter your Apple Music API credentials to connect your music library."
      fields={[
        {
          id: "developer-token",
          label: "Developer Token",
          placeholder: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
          value: data.developerToken || "",
          onChange: (value) => {
            setData({ developerToken: value });
            if (errors.token) setErrors({ token: "" });
          },
        },
        {
          id: "user-token",
          label: "Music User Token",
          placeholder: "AqBi2v3...",
          value: data.userToken || "",
          onChange: (value) => {
            setData({ userToken: value });
            if (errors.token) setErrors({ token: "" });
          },
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
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Resources
// ─────────────────────────────────────────────────────────────────────────────

function SelectResourcesStepComponent({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<AppleMusicWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const selectedResources = data.selectedResources || [];

  const availableSources = ALL_SOURCES.filter(
    (s) => !data.currentResources?.some((r: any) => r.source === s.id)
  );

  const toggleResource = (resourceId: string | number) => {
    const id = String(resourceId);
    const next = selectedResources.includes(id)
      ? selectedResources.filter((r) => r !== id)
      : [...selectedResources, id];
    setData({ selectedResources: next });
  };

  const handleSave = async () => {
    if (selectedResources.length === 0) {
      setErrors({ resources: "Please select at least one resource" });
      return;
    }

    setLoading(true);
    setErrors({ resources: "" });

    try {
      const startTime = Date.now();

      await saveResources({
        provider: "apple-music",
        connectionId: data.connectionId,
        resources: selectedResources as any,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedRepos("apple-music").unwrap();
        if (result.success) {
          setData({
            currentResources: result.repos || [],
            selectedResources: [],
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        resources: err?.data?.error || err?.message || "Failed to save resources",
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
      selectedResources={selectedResources}
      onToggleResource={toggleResource}
      loading={loading}
      error={errors.resources || ""}
      onSave={handleSave}
      onBack={handleBack}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Resources
// ─────────────────────────────────────────────────────────────────────────────

function ManageResourcesStepComponent({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<AppleMusicWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const handleRemove = async (resourceId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(resourceId).unwrap();
      const result = await getSelectedRepos("apple-music").unwrap();
      if (result.success) {
        setData({ currentResources: result.repos || [] });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "Failed to remove resource",
      });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const currentResourceIds = new Set(
        data.currentResources?.map((r: any) => r.source) || []
      );

      const availableSources = ALL_SOURCES.filter(
        (s) => !currentResourceIds.has(s.id)
      );

      if (availableSources.length === 0) {
        setErrors({ manage: "All sources are already connected" });
        return;
      }

      setData({
        selectedResources: [],
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "Failed to load resources",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentResources || []}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

const AppleMusicModal = ({
  open,
  onClose,
  isConnected,
  onSuccess,
}: AppleMusicModalProps) => {
  const [initializing, setInitializing] = useState(true);
  const [targetStep, setTargetStep] = useState<StepId | null>(null);
  const [initialData, setInitialData] = useState<Partial<AppleMusicWizardData>>({});
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [getSelectedRepos] = useLazyGetSelectedReposQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitializing(true);
      setTargetStep(null);
      return;
    }

    const loadInitialData = async () => {
      setInitializing(true);
      setTargetStep(null);

      const baseData: Partial<AppleMusicWizardData> = {
        developerToken: "",
        userToken: "",
        selectedResources: [],
        currentResources: [],
        fromManage: false,
      };

      if (!isConnected) {
        setInitialData(baseData);
        setTargetStep("setToken");
        setInitializing(false);
        return;
      }

      let finalStep: StepId = "setToken";
      let finalData: Partial<AppleMusicWizardData> = baseData;

      try {
        const startTime = Date.now();
        const result = await getSelectedRepos("apple-music").unwrap();

        if (result.success) {
          finalData = {
            ...baseData,
            connectionId: result.connectionId,
            currentResources: result.repos || [],
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
      await revokeConnection("apple-music").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<AppleMusicWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={targetStep} />,
    },
    {
      id: "setToken",
      render: () => <TokenStep onSuccess={onSuccess} />,
    },
    {
      id: "add",
      render: () => <SelectResourcesStepComponent onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageResourcesStepComponent
          onRevoke={() => setShowRevokeConfirm(true)}
        />
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
        title="Apple Music"
        icon="connections/apple-music.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Apple Music"
        />
      )}
    </>
  );
};

export default AppleMusicModal;
