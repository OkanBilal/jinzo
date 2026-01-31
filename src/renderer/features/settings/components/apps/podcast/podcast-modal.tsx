import { useState, useEffect, useCallback } from "react";

import {
  BodyMedium,
  Body,
  Muted,
  ErrorText,
} from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSelectedPodcastsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type SelectedPodcast,
} from "../../../../../lib/redux/api";
import { Button } from "../../../../../components/ui/button";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { CredentialStep } from "../shared/credential-step";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PodcastModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
}

interface PodcastWizardData {
  apiKey: string;
  userId: string;
  connectionId: string;
  podcastName: string;
  podcastsToAdd: string[];
  currentPodcasts: SelectedPodcast[];
  fromManage: boolean;
}

type StepId = "loading" | "tokenSet" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Credentials
// ─────────────────────────────────────────────────────────────────────────────

function CredentialsStep() {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<PodcastWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();

  const handleSubmit = async () => {
    if (!data.apiKey?.trim() || !data.userId?.trim()) {
      setErrors({ credentials: "Please enter both API Key and User ID" });
      return;
    }

    setLoading(true);
    setErrors({ credentials: "" });

    try {
      const connResult = await getConnection("podcast").unwrap();

      if (!connResult.success || !connResult.connection) {
        throw new Error("Failed to get connection");
      }

      const connId = connResult.connection.id;

      await saveCredentials({
        provider: "podcast",
        connectionId: connId,
        apiKey: data.apiKey,
        userId: data.userId,
      }).unwrap();

      setData({ connectionId: connId });
      goTo("add");
    } catch (err: any) {
      setErrors({
        credentials: err?.data?.error || err?.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Taddy.org API credentials to connect your podcasts."
      fields={[
        {
          id: "podcast-api-key",
          label: "API Key",
          placeholder: "Your Taddy API Key",
          value: data.apiKey || "",
          onChange: (value) => {
            setData({ apiKey: value });
            if (errors.credentials) setErrors({ credentials: "" });
          },
        },
        {
          id: "podcast-user-id",
          label: "User ID",
          placeholder: "Your Taddy User ID",
          value: data.userId || "",
          onChange: (value) => {
            setData({ userId: value });
            if (errors.credentials) setErrors({ credentials: "" });
          },
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
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.credentials || ""}
      submitLabel="Continue"
      loadingLabel="Connecting..."
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Add Podcasts
// ─────────────────────────────────────────────────────────────────────────────

function AddPodcastsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<PodcastWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedPodcasts] = useLazyGetSelectedPodcastsQuery();

  const podcastsToAdd = data.podcastsToAdd || [];
  const podcastName = data.podcastName || "";

  const handleAddPodcast = () => {
    if (!podcastName.trim()) {
      setErrors({ podcasts: "Please enter a podcast name" });
      return;
    }

    if (podcastsToAdd.includes(podcastName.trim())) {
      setErrors({ podcasts: "This podcast is already in the list" });
      return;
    }

    setData({
      podcastsToAdd: [...podcastsToAdd, podcastName.trim()],
      podcastName: "",
    });
    setErrors({ podcasts: "" });
  };

  const handleRemovePodcast = (name: string) => {
    setData({
      podcastsToAdd: podcastsToAdd.filter((p) => p !== name),
    });
  };

  const handleSave = async () => {
    if (podcastsToAdd.length === 0) {
      setErrors({ podcasts: "Please add at least one podcast" });
      return;
    }

    setLoading(true);
    setErrors({ podcasts: "" });

    try {
      const podcasts = podcastsToAdd.map((name) => ({ name }));

      await saveResources({
        provider: "podcast",
        connectionId: data.connectionId,
        resources: podcasts,
      }).unwrap();

      if (data.fromManage) {
        const result = await getSelectedPodcasts("podcast").unwrap();
        if (result.success) {
          setData({
            currentPodcasts: result.podcasts || [],
            podcastsToAdd: [],
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        podcasts: err?.data?.error || err?.message || "An error occurred",
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
    <div className="space-y-4">
      <Muted>
        Add podcasts you want to follow. {podcastsToAdd.length} added.
      </Muted>

      <div className="flex gap-2">
        <Input
          type="text"
          value={podcastName}
          onChange={(e) => setData({ podcastName: e.target.value })}
          placeholder="Enter podcast name"
          className="w-full px-3 py-2.5 dark:bg-primary! shadow-none! dark:placeholder:text-primary-800! dark:text-primary-900 "
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddPodcast();
          }}
        />
        <Button
          variant="submit"
          size="sm"
          onClick={handleAddPodcast}
          disabled={loading || !podcastName.trim()}
        >
          Add
        </Button>
      </div>

      {podcastsToAdd.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-primary-200 dark:border-primary-900 rounded-xl">
          {podcastsToAdd.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between px-4 py-3 border-b border-primary-200 dark:border-primary-900 last:border-b-0"
            >
              <Body>{name}</Body>
              <Button
                variant="danger"
                onClick={() => handleRemovePodcast(name)}
                disabled={loading}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {errors.podcasts && <ErrorText>{errors.podcasts}</ErrorText>}

      <div className="flex justify-between gap-3 pt-2">
        <Button
          variant="link"
          onClick={handleBack}
          disabled={loading}
          className="px-1"
        >
          Back
        </Button>
        <Button
          variant="submit"
          onClick={handleSave}
          disabled={loading || podcastsToAdd.length === 0}
          isLoading={loading}
          className="ml-auto"
        >
          {loading ? "Saving..." : `Finish (${podcastsToAdd.length} Podcast${podcastsToAdd.length > 1 ? "s" : ""})`}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Podcasts
// ─────────────────────────────────────────────────────────────────────────────

function ManagePodcastsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<PodcastWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getSelectedPodcasts] = useLazyGetSelectedPodcastsQuery();

  const handleRemove = async (podcastId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(podcastId).unwrap();
      const result = await getSelectedPodcasts("podcast").unwrap();
      if (result.success) {
        setData({ currentPodcasts: result.podcasts || [] });
      }
    } catch (err: any) {
      setErrors({
        manage: err?.data?.error || err?.message || "An error occurred",
      });
    }
  };

  const handleAddNew = () => {
    setData({
      podcastsToAdd: [],
      podcastName: "",
      fromManage: true,
    });
    goTo("add");
  };

  return (
    <ManageResourcesStep
      resources={data.currentPodcasts}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="podcast"
      resourceLabelPlural="podcasts"
      addButtonLabel="Add Podcast"
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <BodyMedium>{resource.name}</BodyMedium>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<PodcastWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading podcasts...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function PodcastModal({
  open,
  onClose,
  isConnected,
}: PodcastModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initialData, setInitialData] = useState<Partial<PodcastWizardData>>({});
  const [targetStep, setTargetStep] = useState<StepId | null>(null);

  const [getSelectedPodcasts] = useLazyGetSelectedPodcastsQuery();
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

      const baseData: Partial<PodcastWizardData> = {
        apiKey: "",
        userId: "",
        podcastName: "",
        podcastsToAdd: [],
        currentPodcasts: [],
        fromManage: false,
      };

      if (!isConnected) {
        setInitialData(baseData);
        setTargetStep("tokenSet");
        setInitializing(false);
        return;
      }

      let finalStep: StepId = "tokenSet";
      let finalData: Partial<PodcastWizardData> = baseData;

      try {
        const startTime = Date.now();
        const result = await getSelectedPodcasts("podcast").unwrap();

        if (result.success) {
          finalData = {
            ...baseData,
            connectionId: result.connectionId,
            currentPodcasts: result.podcasts || [],
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
  }, [open, isConnected, getSelectedPodcasts]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("podcast").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<PodcastWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={targetStep} />,
    },
    {
      id: "tokenSet",
      render: () => <CredentialsStep />,
    },
    {
      id: "add",
      render: () => <AddPodcastsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManagePodcastsStep onRevoke={() => setShowRevokeConfirm(true)} />
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
        title="Podcast Connection"
        icon="/connections/podcast.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Podcast"
          description="This will disconnect all podcasts."
        />
      )}
    </>
  );
}
