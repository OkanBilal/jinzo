import { useState, useEffect } from "react";

import { Lock } from "../../../../../components/ui/icons";
import { BodyMedium } from "../../../../../components/ui/text";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitHubReposQuery,
  useLazyGetSelectedReposQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type GitHubRepo,
  type SelectedRepo,
} from "../../../../../lib/redux/api";
import {
  ConnectionModalWrapper,
  LoadingState,
} from "../shared/connection-modal-wrapper";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

interface GitHubModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

type Step = "setToken" | "add" | "manage";

export default function GitHubModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: GitHubModalProps) {
  const [step, setStep] = useState<Step>("setToken");
  const [token, setToken] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [currentRepos, setCurrentRepos] = useState<SelectedRepo[]>([]);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [isFirstConnection, setIsFirstConnection] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials, { isLoading: isSavingCredentials }] =
    useSaveCredentialsMutation();
  const [getGitHubRepos] = useLazyGetGitHubReposQuery();
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

  const loadCurrentRepos = async () => {
    try {
      const result = await getSelectedRepos("github").unwrap();

      if (result.success) {
        setCurrentRepos(result.repos);
        setConnectionId(result.connectionId);
        setStep("manage");
      } else {
        // If no repos found but connection exists, go to manage step with empty list
        setCurrentRepos([]);
        const connResult = await getConnection("github").unwrap();
        if (connResult.success) {
          setConnectionId(connResult.connection.id);
          setStep("manage");
        } else {
          setStep("setToken");
        }
      }
    } catch (err) {
      console.error("[loadCurrentRepos] Error:", err);
      try {
        const connResult = await getConnection("github").unwrap();
        if (connResult.success) {
          setCurrentRepos([]);
          setConnectionId(connResult.connection.id);
          setStep("manage");
        } else {
          setStep("setToken");
        }
      } catch (connErr) {
        console.error("[loadCurrentRepos] Connection check error:", connErr);
        setError(err instanceof Error ? err.message : "Failed to load repos");
        setStep("setToken");
      }
    }
  };

  useEffect(() => {
    if (open) {
      setInitializing(true);
      if (isConnected && !isFirstConnection) {
        const startTime = Date.now();
        loadCurrentRepos().finally(() => {
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
    setToken("");
    setConnectionId("");
    setRepos([]);
    setSelectedRepos(new Set());
    setCurrentRepos([]);
    setError("");
    setStep("setToken");
    setInitializing(false);
    setIsFirstConnection(false);
    onClose();
  };

  const handleCredentialSubmit = async () => {
    if (!token.trim()) {
      setError("Please enter a valid token");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("github").unwrap();

      if (!connectionResult.success) {
        console.error("[GitHub] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;
      setConnectionId(connId);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const credResult = await saveCredentials({
        provider: "github",
        connectionId: connId,
        token,
      }).unwrap();
      setIsFirstConnection(true);

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

      setRepos(reposResult.repos);
      setStep("add");
    } catch (err: any) {
      console.error("[GitHub] Error in credential submit:", err);
      const errorMessage =
        err?.data?.error || err?.message || "An error occurred";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRepo = (fullName: string | number) => {
    const name = String(fullName);
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleSaveRepos = async () => {
    if (selectedRepos.size === 0) {
      setError("Please select at least one repository");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const startTime = Date.now();

      const selectedRepoObjects = repos.filter((repo) =>
        selectedRepos.has(repo.fullName)
      );

      await saveResources({
        provider: "github",
        connectionId,
        resources: selectedRepoObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (isConnected) {
        setSelectedRepos(new Set());
        await loadCurrentRepos();
        setStep("manage");
      } else {
        handleClose();
      }
    } catch (err: any) {
      setError(err?.data?.error || err.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveRepo = async (repoId: string) => {
    setError("");

    try {
      await deleteResource(repoId).unwrap();
      await loadCurrentRepos();
    } catch (err: any) {
      setError(err?.data?.error || err.message || "An error occurred");
    }
  };

  const handleRevokeCredential = () => {
    setShowRevokeConfirm(true);
  };

  const confirmRevoke = async () => {
    setError("");
    setShowRevokeConfirm(false);

    try {
      await revokeConnection("github").unwrap();
      handleClose();
    } catch (err: any) {
      setError(err?.data?.error || err.message || "An error occurred");
    }
  };

  const handleAddNewRepos = async () => {
    setError("");
    setIsProcessing(true);

    try {
      const reposResult = await getGitHubRepos(connectionId).unwrap();

      if (!reposResult.success) {
        throw new Error("Failed to fetch repositories");
      }

      const currentRepoNames = new Set(currentRepos.map((r) => r.fullName));
      const availableRepos = reposResult.repos.filter(
        (repo: GitHubRepo) => !currentRepoNames.has(repo.fullName)
      );

      if (availableRepos.length === 0) {
        setError("All repositories are already connected");
        return;
      }

      setRepos(availableRepos);
      setStep("add");
    } catch (err: any) {
      setError(err?.data?.error || err.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ConnectionModalWrapper
      open={open}
      onClose={handleClose}
      appName="Github"
      appIcon="/apps/github-skeuomorphic.png"
    >
      {initializing ? (
        <LoadingState message="Loading repositories..." />
      ) : step === "setToken" ? (
        <CredentialStep
          description="Enter your GitHub Personal Access Token to connect your repositories."
          fields={[
            {
              id: "github-token",
              label: "Personal Access Token",
              placeholder: "ghp_xxxxxxxxxxxxxxxxxxxx",
              value: token,
              onChange: setToken,
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
          onSubmit={handleCredentialSubmit}
          loading={loading}
          error={error}
        />
      ) : step === "manage" ? (
        <ManageResourcesStep
          resources={currentRepos}
          onAddNew={handleAddNewRepos}
          onRemove={handleRemoveRepo}
          onRevoke={handleRevokeCredential}
          loading={loading}
          error={error}
          resourceLabel="repository"
          resourceLabelPlural="repositories"
          addButtonLabel="Add Repository"
          revokeButtonLabel="Revoke GitHub Access"
          renderResourceItem={(resource) => (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BodyMedium>{resource.fullName}</BodyMedium>
                {resource.metadata?.private && (
                  <Lock className="w-4 h-4 text-primary-500 dark:text-primary-600" />
                )}
              </div>
            </div>
          )}
        />
      ) : (
        <SelectResourcesStep
          resources={repos.map((repo) => ({ ...repo, id: repo.fullName }))}
          selectedResources={selectedRepos}
          onToggleResource={toggleRepo}
          onSave={handleSaveRepos}
          onBack={() => setStep(isConnected ? "manage" : "setToken")}
          loading={loading}
          error={error}
          title="Select the repositories you want to connect."
          saveButtonLabel={`Save ${selectedRepos.size} Repositories`}
          renderResourceItem={(repo) => (
            <div className="flex items-center gap-2">
              <BodyMedium>{repo.fullName}</BodyMedium>
              {repo.private && (
                <Lock className="w-4 h-4 text-primary-500 dark:text-primary-600" />
              )}
            </div>
          )}
        />
      )}

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={confirmRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={loading}
          appName="GitHub"
          description="This will disconnect all repositories and remove all GitHub data. This action cannot be undone."
        />
      )}
    </ConnectionModalWrapper>
  );
}
