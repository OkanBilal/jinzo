import { useState, useReducer, useEffect, useCallback } from "react";

import { BodyMedium, Muted } from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitLabProjectsQuery,
  useLazyGetSelectedGitLabProjectsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type GitLabProject,
  type SelectedGitLabProject,
} from "../../../../../lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { Button } from "@/components/ui/button";
import Text from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import LockIcon from "@/components/ui/icons/lock";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GitLabModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface GitLabWizardData {
  token: string;
  domain: string;
  connectionId: string;
  projects: GitLabProject[];
  selectedProjects: Set<string>;
  currentProjects: SelectedGitLabProject[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

type StepId = "loading" | "setToken" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitLabWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getGitLabProjects] = useLazyGetGitLabProjectsQuery();

  const handleSubmit = async () => {
    if (!data.token?.trim()) {
      setErrors({ token: "Please enter a valid token" });
      return;
    }

    setLoading(true);
    setErrors({ token: "", domain: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("gitlab").unwrap();

      if (!connectionResult.success) {
        console.error("[GitLab] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "gitlab",
        connectionId: connId,
        token: data.token,
        domain: data.domain || "gitlab.com",
      }).unwrap();

      onSuccess?.();

      const projectsResult = await getGitLabProjects(connId).unwrap();

      if (!projectsResult.success) {
        console.error("[GitLab] Failed to fetch projects:", projectsResult);
        throw new Error("Failed to fetch projects");
      }

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 800;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setData({
        connectionId: connId,
        projects: projectsResult.projects,
        isFirstConnection: true,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      console.error("[GitLab] Error in credential submit:", err);

      let errorMessage =
        "Failed to connect to GitLab. Please check your credentials.";

      if (err?.data?.error) {
        errorMessage = err.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setErrors({ token: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-1 py-4 space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="gitlab-domain"
            className="block text-sm font-medium text-primary-700 dark:text-primary-300"
          >
            GitLab Domain
          </label>
          <Input
            id="gitlab-domain"
            type="text"
            placeholder="gitlab.com"
            value={data.domain || ""}
            onChange={(e) => {
              setData({ domain: e.target.value });
              if (errors.domain) setErrors({ domain: "" });
            }}
          />
          <p className="text-xs text-primary-500 dark:text-primary-400">
            Leave empty for gitlab.com, or enter your self-hosted domain (e.g. gitlab.yourcompany.com)
          </p>
          {errors.domain && (
            <p className="text-sm text-red-500">{errors.domain}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="gitlab-token"
            className="block text-sm font-medium text-primary-700 dark:text-primary-300"
          >
            Personal Access Token
          </label>
          <Input
            id="gitlab-token"
            type="password"
            placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            value={data.token || ""}
            onChange={(e) => {
              setData({ token: e.target.value });
              if (errors.token) setErrors({ token: "" });
            }}
          />
          {errors.token && (
            <p className="text-sm text-red-500">{errors.token}</p>
          )}
        </div>
      </div>

      <div className="text-sm text-primary-500 dark:text-primary-400 space-y-1">
        <strong>How to create a token:</strong>
        <br />
        1. Go to GitLab Settings → Access Tokens →{" "}
        <a
          href="https://gitlab.com/-/user_settings/personal_access_tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 underline"
        >
          Personal access tokens
        </a>
        <br />
        2. Create a new token
        <br />
        3. Select scopes: <code>read_api</code>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          variant="submit"
          onClick={handleSubmit}
          disabled={loading || !data.token}
        >
          <Text variant="button">
            {loading ? "Connecting..." : "Continue"}
          </Text>
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Projects
// ─────────────────────────────────────────────────────────────────────────────

function SelectProjectsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitLabWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedProjects] = useLazyGetSelectedGitLabProjectsQuery();

  const selectedProjects = data.selectedProjects || new Set<string>();

  const toggleProject = (projectId: string | number) => {
    const id = String(projectId);
    const next = new Set(selectedProjects);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setData({ selectedProjects: next });
  };

  const handleSave = async () => {
    if (selectedProjects.size === 0) {
      setErrors({ projects: "Please select at least one project" });
      return;
    }

    setLoading(true);
    setErrors({ projects: "" });

    try {
      const startTime = Date.now();

      const selectedProjectObjects = data.projects.filter((project) =>
        selectedProjects.has(String(project.id))
      );

      await saveResources({
        provider: "gitlab",
        connectionId: data.connectionId,
        resources: selectedProjectObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedProjects("gitlab").unwrap();
        if (result.success) {
          setData({
            currentProjects: result.projects,
            selectedProjects: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({
        projects: err?.data?.error || err.message || "An error occurred",
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
      resources={data.projects.map((project) => ({
        ...project,
        id: String(project.id),
      }))}
      selectedResources={selectedProjects}
      onToggleResource={toggleProject}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.projects || ""}
      title="Select the projects you want to sync issues and merge requests from."
      saveButtonLabel={`Save ${selectedProjects.size} Projects`}
      renderResourceItem={(project) => (
        <div className="flex items-center gap-2">
          <BodyMedium>{project.pathWithNamespace || project.name}</BodyMedium>
          {project.visibility && (
            project.visibility === "private" ? (
              <LockIcon className="w-3.5 h-3.5 text-primary-500" />
            ) : (
              <span className="text-xs text-primary-500">{project.visibility}</span>
            )
          )}
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Projects
// ─────────────────────────────────────────────────────────────────────────────

function ManageProjectsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<GitLabWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getGitLabProjects] = useLazyGetGitLabProjectsQuery();
  const [getSelectedProjects] = useLazyGetSelectedGitLabProjectsQuery();

  const handleRemove = async (projectId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(projectId).unwrap();
      const result = await getSelectedProjects("gitlab").unwrap();
      if (result.success) {
        setData({ currentProjects: result.projects });
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
      const projectsResult = await getGitLabProjects(data.connectionId).unwrap();

      if (!projectsResult.success) {
        throw new Error("Failed to fetch projects");
      }

      const currentProjectIds = new Set(
        data.currentProjects.map((p) => p.externalId)
      );
      const availableProjects = projectsResult.projects.filter(
        (project: GitLabProject) => !currentProjectIds.has(String(project.id))
      );

      if (availableProjects.length === 0) {
        setErrors({ manage: "All projects are already connected" });
        return;
      }

      setData({
        projects: availableProjects,
        selectedProjects: new Set(),
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
      resources={data.currentProjects.map((p) => ({
        ...p,
        fullName: p.name,
      }))}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="project"
      resourceLabelPlural="projects"
      addButtonLabel="Add Project"
      revokeButtonLabel="Revoke GitLab Access"
      renderResourceItem={(resource) => {
        const visibility = resource.metadata ? (typeof resource.metadata === 'string' ? JSON.parse(resource.metadata) : resource.metadata)?.visibility : null;
        return (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BodyMedium>{resource.name}</BodyMedium>
              {visibility && (
                visibility === "private" ? (
                  <LockIcon className="w-3.5 h-3.5 text-primary-500" />
                ) : (
                  <span className="text-xs text-primary-500">{visibility}</span>
                )
              )}
            </div>
          </div>
        );
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────────────────────

function LoadingStep({ targetStep }: { targetStep: StepId | null }) {
  const { goTo } = useWizard<GitLabWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading projects...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function GitLabModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: GitLabModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  type InitState = { initializing: boolean; targetStep: StepId | null; data: Partial<GitLabWizardData> };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, targetStep: null, data: {} },
  );

  const [getSelectedProjects] = useLazyGetSelectedGitLabProjectsQuery();
  const [getConnection] = useLazyGetConnectionQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, targetStep: null, data: {} });
      return;
    }

    const loadInitialData = async () => {
      const baseData: Partial<GitLabWizardData> = {
        token: "",
        domain: "",
        projects: [],
        selectedProjects: new Set(),
        currentProjects: [],
        isFirstConnection: false,
        fromManage: false,
      };

      let finalStep: StepId = "setToken";
      let finalData: Partial<GitLabWizardData> = baseData;

      if (isConnected) {
        try {
          const startTime = Date.now();
          const result = await getSelectedProjects("gitlab").unwrap();

          if (result.success) {
            finalData = {
              ...baseData,
              connectionId: result.connectionId,
              currentProjects: result.projects,
            };
            finalStep = "manage";
          } else {
            const connResult = await getConnection("gitlab").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentProjects: [],
              };
              finalStep = "manage";
            }
          }

          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (err) {
          console.error("[loadInitialData] Error:", err);
          try {
            const connResult = await getConnection("gitlab").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentProjects: [],
              };
              finalStep = "manage";
            }
          } catch {
            // Keep defaults
          }
        }
      }

      setInitState({ initializing: false, targetStep: finalStep, data: finalData });
    };

    loadInitialData();
  }, [open, isConnected, getSelectedProjects, getConnection]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    try {
      await revokeConnection("gitlab").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  const steps: WizardStep<GitLabWizardData>[] = [
    {
      id: "loading",
      render: () => <LoadingStep targetStep={initState.targetStep} />,
    },
    {
      id: "setToken",
      render: () => <TokenStep onSuccess={onSuccess} />,
    },
    {
      id: "add",
      render: () => <SelectProjectsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageProjectsStep onRevoke={() => setShowRevokeConfirm(true)} />
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
        initialData={initState.data}
        title="GitLab"
        icon="connections/gitlab.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="GitLab"
          description="This will disconnect all projects and remove all GitLab data. This action cannot be undone."
        />
      )}
    </>
  );
}
