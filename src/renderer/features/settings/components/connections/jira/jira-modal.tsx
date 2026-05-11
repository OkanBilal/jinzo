import { useState } from "react";

import { Body, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetJiraProjectsQuery,
  useLazyGetSelectedProjectsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  type JiraProject,
  type SelectedProject,
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

interface JiraModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface JiraWizardData {
  apiToken: string;
  domain: string;
  email: string;
  connectionId: string;
  projects: JiraProject[];
  selectedProjects: Set<string>;
  currentProjects: SelectedProject[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<JiraWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getJiraProjects] = useLazyGetJiraProjectsQuery();

  const handleSubmit = async () => {
    if (!data.domain?.trim()) {
      setErrors({ domain: "Please enter your Jira domain" });
      return;
    }
    if (!data.email?.trim()) {
      setErrors({ email: "Please enter your email" });
      return;
    }
    if (!data.apiToken?.trim()) {
      setErrors({ apiToken: "Please enter your API token" });
      return;
    }

    setLoading(true);
    setErrors({ domain: "", email: "", apiToken: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("jira").unwrap();

      if (!connectionResult.success) {
        console.error("[Jira] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "jira",
        connectionId: connId,
        apiToken: data.apiToken,
        domain: data.domain,
        email: data.email,
      }).unwrap();

      onSuccess?.();

      const projectsResult = await getJiraProjects(connId).unwrap();

      if (!projectsResult.success) {
        console.error("[Jira] Failed to fetch projects:", projectsResult);
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
      console.error("[Jira] Error in credential submit:", err);

      let errorMessage =
        "Failed to connect to Jira. Please check your credentials.";

      if (err?.status === "CUSTOM_ERROR") {
        errorMessage = err?.error || errorMessage;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else if (err?.data?.error) {
        errorMessage = err.data.error;
      } else if (err?.data?.message) {
        errorMessage = err.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      setErrors({ apiToken: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Jira credentials to connect your projects and sync issues."
      fields={[
        {
          id: "jira-domain",
          label: "Jira Domain",
          placeholder: "your-company.atlassian.net",
          type: "text",
          value: data.domain || "",
          onChange: (value) => {
            setData({ domain: value });
            if (errors.domain) setErrors({ domain: "" });
          },
        },
        {
          id: "jira-email",
          label: "Email",
          placeholder: "you@example.com",
          type: "email",
          value: data.email || "",
          onChange: (value) => {
            setData({ email: value });
            if (errors.email) setErrors({ email: "" });
          },
        },
        {
          id: "jira-api-token",
          label: "API Token",
          placeholder: "Your API token",
          value: data.apiToken || "",
          onChange: (value) => {
            setData({ apiToken: value });
            if (errors.apiToken) setErrors({ apiToken: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to create an API token:</strong>
          <br />
          1. Go to{" "}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Atlassian API tokens
          </a>
          <br />
          2. Click &quot;Create API token&quot;
          <br />
          3. Give it a name and copy the token
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.apiToken || errors.email || errors.domain || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Projects
// ─────────────────────────────────────────────────────────────────────────────

function SelectProjectsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<JiraWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedProjects] = useLazyGetSelectedProjectsQuery();

  const selectedProjects = data.selectedProjects || new Set<string>();

  const toggleProject = (projectKey: string | number) => {
    const key = String(projectKey);
    const next = new Set(selectedProjects);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
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
        selectedProjects.has(project.key)
      );

      await saveResources({
        provider: "jira",
        connectionId: data.connectionId,
        resources: selectedProjectObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedProjects("jira").unwrap();
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
      resources={data.projects.map((project) => ({ ...project, id: project.key }))}
      selectedResources={selectedProjects}
      onToggleResource={toggleProject}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.projects || ""}
      title="Select the projects you want to sync issues from."
      saveButtonLabel={`Save ${selectedProjects.size} Projects`}
      renderResourceItem={(project) => (
        <div className="flex items-center gap-2">
          <Body>{project.name}</Body>
          <span className="text-xs text-primary-500">{project.key}</span>
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
    useWizard<JiraWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getJiraProjects] = useLazyGetJiraProjectsQuery();
  const [getSelectedProjects] = useLazyGetSelectedProjectsQuery();

  const handleRemove = async (projectId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(projectId).unwrap();
      const result = await getSelectedProjects("jira").unwrap();
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
      const projectsResult = await getJiraProjects(data.connectionId).unwrap();

      if (!projectsResult.success) {
        throw new Error("Failed to fetch projects");
      }

      const currentProjectKeys = new Set(data.currentProjects.map((p) => p.key));
      const availableProjects = projectsResult.projects.filter(
        (project: JiraProject) => !currentProjectKeys.has(project.key)
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
      revokeButtonLabel="Revoke Jira Access"
      extraContent={<AutoSyncSection provider="jira" providerLabel="Jira" />}
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.name}</Body>
            <span className="text-xs text-primary-500">{resource.key}</span>
          </div>
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function JiraModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: JiraModalProps) {
  const [getSelectedProjects] = useLazyGetSelectedProjectsQuery();

  const { initState, showRevokeConfirm, setShowRevokeConfirm, handleClose, handleRevoke, isRevoking } =
    useConnectionModalState<JiraWizardData>({
      open,
      onClose,
      isConnected,
      provider: "jira",
      appName: "Jira",
      baseData: {
        apiToken: "",
        domain: "",
        email: "",
        projects: [],
        selectedProjects: new Set(),
        currentProjects: [],
        isFirstConnection: false,
        fromManage: false,
      },
      fetchSelected: async () => {
        const result = await getSelectedProjects("jira").unwrap();
        if (!result.success) return null;
        return { connectionId: result.connectionId, currentProjects: result.projects };
      },
    });

  const steps: WizardStep<JiraWizardData>[] = [
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
        title="Jira"
        icon="connections/jira.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Jira"
          description="This will disconnect all projects and remove all Jira data. This action cannot be undone."
        />
      )}
    </>
  );
}
