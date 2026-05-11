import { useState } from "react";

import { Body, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetGitLabProjectsQuery,
  useLazyGetSelectedGitLabProjectsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  type GitLabProject,
  type SelectedGitLabProject,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";
import { AutoSyncSection } from "../shared/auto-sync-section";
import LockIcon from "@/components/ui/icons/lock";
import { useConnectionModalState } from "../shared/use-connection-modal-state";
import { ConnectionLoadingStep } from "../shared/connection-loading-step";

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
    <CredentialStep
      description="Enter your GitLab credentials to connect your projects and sync issues."
      fields={[
        {
          id: "gitlab-domain",
          label: "GitLab Domain",
          placeholder: "gitlab.com",
          type: "text",
          required: false,
          value: data.domain || "",
          helperText: "Leave empty for gitlab.com, or enter your self-hosted domain (e.g. gitlab.yourcompany.com)",
          onChange: (value) => {
            setData({ domain: value });
            if (errors.domain) setErrors({ domain: "" });
          },
        },
        {
          id: "gitlab-token",
          label: "Personal Access Token",
          placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
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
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || errors.domain || ""}
    />
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
          <Body>{project.pathWithNamespace || project.name}</Body>
          {project.visibility && (
            project.visibility === "private" ? (
              <LockIcon className="w-3 h-3 text-primary-500" />
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
      extraContent={<AutoSyncSection provider="gitlab" providerLabel="GitLab" />}
      renderResourceItem={(resource) => {
        const visibility = resource.metadata
          ? (typeof resource.metadata === "string"
              ? JSON.parse(resource.metadata)
              : resource.metadata)?.visibility
          : null;
        return (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Body>{resource.name}</Body>
              {visibility && (
                visibility === "private" ? (
                  <LockIcon className="w-3 h-3 text-primary-500" />
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
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function GitLabModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: GitLabModalProps) {
  const [getSelectedProjects] = useLazyGetSelectedGitLabProjectsQuery();

  const { initState, showRevokeConfirm, setShowRevokeConfirm, handleClose, handleRevoke, isRevoking } =
    useConnectionModalState<GitLabWizardData>({
      open,
      onClose,
      isConnected,
      provider: "gitlab",
      appName: "GitLab",
      baseData: {
        token: "",
        domain: "",
        projects: [],
        selectedProjects: new Set(),
        currentProjects: [],
        isFirstConnection: false,
        fromManage: false,
      },
      fetchSelected: async () => {
        const result = await getSelectedProjects("gitlab").unwrap();
        if (!result.success) return null;
        return { connectionId: result.connectionId, currentProjects: result.projects };
      },
    });

  const steps: WizardStep<GitLabWizardData>[] = [
    {
      id: "loading",
      render: () => (
        <ConnectionLoadingStep
          targetStep={initState.targetStep}
          message="Loading projects..."
        />
      ),
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
      render: () => <ManageProjectsStep onRevoke={() => setShowRevokeConfirm(true)} />,
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
