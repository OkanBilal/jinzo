import { useState, useReducer, useEffect, useCallback } from "react";

import { Body, Muted } from "../../../../../components/ui/text";
import {
  WizardModal,
  useWizard,
  type WizardStep,
} from "../../../../../components/ui/wizard-modal";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetAsanaProjectsQuery,
  useLazyGetSelectedAsanaProjectsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type AsanaProject,
  type SelectedAsanaProject,
} from "../../../../../lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AsanaModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface AsanaWizardData {
  token: string;
  connectionId: string;
  projects: AsanaProject[];
  selectedProjects: Set<string>;
  currentProjects: SelectedAsanaProject[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

type StepId = "loading" | "setToken" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<AsanaWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getAsanaProjects] = useLazyGetAsanaProjectsQuery();

  const handleSubmit = async () => {
    if (!data.token?.trim()) {
      setErrors({ token: "Please enter a valid token" });
      return;
    }

    setLoading(true);
    setErrors({ token: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("asana").unwrap();

      if (!connectionResult.success) {
        console.error("[Asana] Failed to get connection:", connectionResult);
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "asana",
        connectionId: connId,
        accessToken: data.token,
      }).unwrap();

      onSuccess?.();

      const projectsResult = await getAsanaProjects(connId).unwrap();

      if (!projectsResult.success) {
        console.error("[Asana] Failed to fetch projects:", projectsResult);
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
      console.error("[Asana] Error in credential submit:", err);
      const errorMessage =
        err?.data?.error || err?.message || "An error occurred";
      setErrors({ token: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Asana Personal Access Token to connect your projects."
      fields={[
        {
          id: "asana-token",
          label: "Personal Access Token",
          placeholder: "0/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
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
          1. Go to{" "}
          <a
            href="https://app.asana.com/0/my-apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Asana Developer Console
          </a>
          <br />
          2. Click &quot;Create new token&quot;
          <br />
          3. Give it a name and copy the token
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.token || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Projects
// ─────────────────────────────────────────────────────────────────────────────

function SelectProjectsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<AsanaWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedProjects] = useLazyGetSelectedAsanaProjectsQuery();

  const selectedProjects = data.selectedProjects || new Set<string>();

  const toggleProject = (projectGid: string | number) => {
    const gid = String(projectGid);
    const next = new Set(selectedProjects);
    if (next.has(gid)) {
      next.delete(gid);
    } else {
      next.add(gid);
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
        selectedProjects.has(project.gid)
      );

      await saveResources({
        provider: "asana",
        connectionId: data.connectionId,
        resources: selectedProjectObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const minLoadingTime = 1000;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      // If coming from manage step, reload and go back to manage
      if (data.fromManage) {
        const result = await getSelectedProjects("asana").unwrap();
        if (result.success) {
          setData({
            currentProjects: result.projects,
            selectedProjects: new Set(),
          });
        }
        goTo("manage");
      } else {
        // First time setup - close modal
        onComplete();
      }
    } catch (err: any) {
      setErrors({ projects: err?.data?.error || err.message || "An error occurred" });
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
      resources={data.projects.map((project) => ({ ...project, id: project.gid }))}
      selectedResources={selectedProjects}
      onToggleResource={toggleProject}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.projects || ""}
      title="Select the projects you want to sync tasks from."
      saveButtonLabel={`Save ${selectedProjects.size} Projects`}
      renderResourceItem={(project) => (
        <div className="flex items-center gap-2">
          <Body>{project.name}</Body>
          {project.workspaceName && (
            <span className="text-xs text-primary-500">{project.workspaceName}</span>
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
    useWizard<AsanaWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getAsanaProjects] = useLazyGetAsanaProjectsQuery();
  const [getSelectedProjects] = useLazyGetSelectedAsanaProjectsQuery();

  const handleRemove = async (projectId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(projectId).unwrap();
      // Reload current projects
      const result = await getSelectedProjects("asana").unwrap();
      if (result.success) {
        setData({ currentProjects: result.projects });
      }
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const projectsResult = await getAsanaProjects(data.connectionId).unwrap();

      if (!projectsResult.success) {
        throw new Error("Failed to fetch projects");
      }

      const currentProjectGids = new Set(data.currentProjects.map((p) => p.gid));
      const availableProjects = projectsResult.projects.filter(
        (project: AsanaProject) => !currentProjectGids.has(project.gid)
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
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
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
      revokeButtonLabel="Revoke Asana Access"
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.name}</Body>
            {resource.metadata?.workspaceName && (
              <span className="text-xs text-primary-500">{resource.metadata.workspaceName}</span>
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
  const { goTo } = useWizard<AsanaWizardData>();

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

export default function AsanaModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: AsanaModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  type InitState = { initializing: boolean; targetStep: StepId | null; data: Partial<AsanaWizardData> };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, targetStep: null, data: {} },
  );

  const [getSelectedProjects] = useLazyGetSelectedAsanaProjectsQuery();
  const [getConnection] = useLazyGetConnectionQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  // Load initial data when modal opens
  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, targetStep: null, data: {} });
      return;
    }

    const loadInitialData = async () => {
      const baseData: Partial<AsanaWizardData> = {
        token: "",
        projects: [],
        selectedProjects: new Set(),
        currentProjects: [],
        isFirstConnection: false,
        fromManage: false,
      };

      let finalStep: StepId = "setToken";
      let finalData: Partial<AsanaWizardData> = baseData;

      if (isConnected) {
        try {
          const startTime = Date.now();
          const result = await getSelectedProjects("asana").unwrap();

          if (result.success) {
            finalData = {
              ...baseData,
              connectionId: result.connectionId,
              currentProjects: result.projects,
            };
            finalStep = "manage";
          } else {
            const connResult = await getConnection("asana").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentProjects: [],
              };
              finalStep = "manage";
            }
          }

          // Ensure minimum loading time for smooth UX
          const elapsed = Date.now() - startTime;
          const minLoadingTime = 600;
          const remainingTime = Math.max(0, minLoadingTime - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (err) {
          console.error("[loadInitialData] Error:", err);
          try {
            const connResult = await getConnection("asana").unwrap();
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
      await revokeConnection("asana").unwrap();
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
    }
  };

  // Define wizard steps
  const steps: WizardStep<AsanaWizardData>[] = [
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
        <ManageProjectsStep
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
        initialData={initState.data}
        title="Asana"
        icon="connections/asana.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Asana"
          description="This will disconnect all projects and remove all Asana data. This action cannot be undone."
        />
      )}
    </>
  );
}
