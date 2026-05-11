import { useState } from "react";

import { Lock } from "@/components/ui/icons";
import { Body, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetSelectedReposQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  type GitHubRepo,
  type SelectedRepo,
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

interface GitHubModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface GitHubWizardData {
  token: string;
  connectionId: string;
  repos: GitHubRepo[];
  selectedRepos: Set<string>;
  currentRepos: SelectedRepo[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitHubWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getGitHubRepos] = useLazyGetGitHubReposQuery();

  const handleSubmit = async () => {
    if (!data.token?.trim()) {
      setErrors({ token: "Please enter a valid token" });
      return;
    }

    setLoading(true);
    setErrors({ token: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("github").unwrap();

      if (!connectionResult.success) {
        console.error("[GitHub] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "github",
        connectionId: connId,
        token: data.token,
      }).unwrap();

      onSuccess?.();

      const reposResult = await getGitHubRepos(connId).unwrap();

      if (!reposResult.success) {
        console.error("[GitHub] Failed to fetch repos:", reposResult);
        throw new Error("Failed to fetch repositories");
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setData({
        connectionId: connId,
        repos: reposResult.repos,
        isFirstConnection: true,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      console.error("[GitHub] Error in credential submit:", err);
      const errorMessage =
        err?.data?.error || err?.message || "An error occurred";
      setErrors({ token: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your GitHub Personal Access Token to connect your repositories."
      fields={[
        {
          id: "github-token",
          label: "Personal Access Token",
          placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
          value: data.token || "",
          onChange: (value) => {
            setData({ token: value });
            if (errors.token) setErrors({ token: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to create a token:</strong>
          <br />
          1. Go to GitHub Settings → Developer settings →{" "}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Personal access tokens
          </a>
          <br />
          2. Generate new token (classic)
          <br />
          3. Select scopes: <code>repo</code> and <code>read:user</code>
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Repositories
// ─────────────────────────────────────────────────────────────────────────────

function SelectReposStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitHubWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const selectedRepos = data.selectedRepos || new Set<string>();

  const toggleRepo = (fullName: string | number) => {
    const name = String(fullName);
    const next = new Set(selectedRepos);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setData({ selectedRepos: next });
  };

  const handleSave = async () => {
    if (selectedRepos.size === 0) {
      setErrors({ repos: "Please select at least one repository" });
      return;
    }

    setLoading(true);
    setErrors({ repos: "" });

    try {
      const startTime = Date.now();

      const selectedRepoObjects = data.repos.filter((repo) =>
        selectedRepos.has(repo.fullName)
      );

      await saveResources({
        provider: "github",
        connectionId: data.connectionId,
        resources: selectedRepoObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedRepos("github").unwrap();
        if (result.success) {
          setData({
            currentRepos: result.repos,
            selectedRepos: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({ repos: err?.data?.error || err.message || "An error occurred" });
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
      resources={data.repos.map((repo) => ({ ...repo, id: repo.fullName }))}
      selectedResources={selectedRepos}
      onToggleResource={toggleRepo}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.repos || ""}
      title="Select the repositories you want to connect."
      saveButtonLabel={`Save ${selectedRepos.size} Repositories`}
      renderResourceItem={(repo) => (
        <div className="flex items-center gap-2">
          <Body>{repo.fullName}</Body>
          {repo.private && (
            <Lock className="w-3 h-3 text-primary-500 dark:text-primary-600" />
          )}
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Repositories
// ─────────────────────────────────────────────────────────────────────────────

function ManageReposStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitHubWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getGitHubRepos] = useLazyGetGitHubReposQuery();
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const handleRemove = async (repoId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(repoId).unwrap();
      const result = await getSelectedRepos("github").unwrap();
      if (result.success) {
        setData({ currentRepos: result.repos });
      }
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const reposResult = await getGitHubRepos(data.connectionId).unwrap();

      if (!reposResult.success) {
        throw new Error("Failed to fetch repositories");
      }

      const currentRepoNames = new Set(data.currentRepos.map((r) => r.fullName));
      const availableRepos = reposResult.repos.filter(
        (repo: GitHubRepo) => !currentRepoNames.has(repo.fullName)
      );

      if (availableRepos.length === 0) {
        setErrors({ manage: "All repositories are already connected" });
        return;
      }

      setData({
        repos: availableRepos,
        selectedRepos: new Set(),
        fromManage: true,
      });
      goTo("add");
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ManageResourcesStep
      resources={data.currentRepos}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="repository"
      resourceLabelPlural="repositories"
      addButtonLabel="Add Repository"
      revokeButtonLabel="Revoke GitHub Access"
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.fullName}</Body>
            {resource.metadata?.private && (
              <Lock className="w-3 h-3 text-primary-500 dark:text-primary-600" />
            )}
          </div>
        </div>
      )}
      extraContent={<AutoSyncSection provider="github" providerLabel="GitHub" />}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function GitHubModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: GitHubModalProps) {
  const [getSelectedRepos] = useLazyGetSelectedReposQuery();

  const { initState, showRevokeConfirm, setShowRevokeConfirm, handleClose, handleRevoke, isRevoking } =
    useConnectionModalState<GitHubWizardData>({
      open,
      onClose,
      isConnected,
      provider: "github",
      appName: "GitHub",
      baseData: {
        token: "",
        repos: [],
        selectedRepos: new Set(),
        currentRepos: [],
        isFirstConnection: false,
        fromManage: false,
      },
      fetchSelected: async () => {
        const result = await getSelectedRepos("github").unwrap();
        if (!result.success) return null;
        return { connectionId: result.connectionId, currentRepos: result.repos };
      },
    });

  const steps: WizardStep<GitHubWizardData>[] = [
    {
      id: "loading",
      render: () => (
        <ConnectionLoadingStep
          targetStep={initState.targetStep}
          message="Loading repositories..."
        />
      ),
    },
    {
      id: "setToken",
      render: () => <TokenStep onSuccess={onSuccess} />,
    },
    {
      id: "add",
      render: () => <SelectReposStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => <ManageReposStep onRevoke={() => setShowRevokeConfirm(true)} />,
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
        title="Github"
        icon="connections/github.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="GitHub"
          description="This will disconnect all repositories and remove all GitHub data. This action cannot be undone."
        />
      )}
    </>
  );
}
