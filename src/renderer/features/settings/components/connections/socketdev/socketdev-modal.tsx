import { useState, useReducer, useEffect, useCallback } from "react";

import { Body, Muted, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSocketDevOrganizationsQuery,
  useLazyGetSelectedSocketDevOrganizationsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useRevokeConnectionMutation,
  type SocketDevOrganization,
  type SelectedSocketDevOrganization,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { toast } from "@/components/ui";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SocketDevModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
}

interface SocketDevWizardData {
  apiToken: string;
  connectionId: string;
  organizations: SocketDevOrganization[];
  selectedOrgs: Set<string>;
  currentOrgs: SelectedSocketDevOrganization[];
  isFirstConnection: boolean;
  fromManage: boolean;
}

type StepId = "loading" | "setToken" | "add" | "manage";

// ─────────────────────────────────────────────────────────────────────────────
// Step: Set Token
// ─────────────────────────────────────────────────────────────────────────────

function TokenStep({ onSuccess }: { onSuccess?: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SocketDevWizardData>();
  const [loading, setLoading] = useState(false);

  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();
  const [getOrganizations] = useLazyGetSocketDevOrganizationsQuery();

  const handleSubmit = async () => {
    if (!data.apiToken?.trim()) {
      setErrors({ apiToken: "Please enter a valid API token" });
      return;
    }

    setLoading(true);
    setErrors({ apiToken: "" });

    try {
      const startTime = Date.now();
      const connectionResult = await getConnection("socketdev").unwrap();

      if (!connectionResult.success) {
        throw new Error("Failed to get connection");
      }

      const connId = connectionResult.connection.id;

      await saveCredentials({
        provider: "socketdev",
        connectionId: connId,
        apiToken: data.apiToken,
      }).unwrap();

      onSuccess?.();

      const orgsResult = await getOrganizations(connId).unwrap();

      if (!orgsResult.success) {
        throw new Error("Failed to fetch organizations");
      }

      if (!orgsResult.success) {
        throw new Error("Failed to fetch organizations");
      }

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 800 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setData({
        connectionId: connId,
        organizations: orgsResult.organizations,
        isFirstConnection: true,
        fromManage: false,
      });

      goTo("add");
    } catch (err: any) {
      const errorMessage =
        err?.data?.error || err?.message || "An error occurred";
      setErrors({ apiToken: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description="Enter your Socket.dev API token to connect your organizations."
      fields={[
        {
          id: "socketdev-token",
          label: "API Token",
          placeholder: "sktsec_xxxxxxxxxxxxxxxxxxxx",
          value: data.apiToken || "",
          onChange: (value) => {
            setData({ apiToken: value });
            if (errors.apiToken) setErrors({ apiToken: "" });
          },
        },
      ]}
      instructions={
        <>
          <strong>How to create a token:</strong>
          <br />
          1. Go to{" "}
          <a
            href="https://socket.dev/dashboard/org/settings/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 dark:text-primary-400 underline"
          >
            Socket.dev Settings &rarr; API Tokens
          </a>
          <br />
          2. Create a new API token
          <br />
          3. Copy the token and paste it here
        </>
      }
      onSubmit={handleSubmit}
      loading={loading}
      error={errors.apiToken || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Select Organizations
// ─────────────────────────────────────────────────────────────────────────────

function SelectOrgsStep({ onComplete }: { onComplete: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SocketDevWizardData>();
  const [loading, setLoading] = useState(false);

  const [saveResources] = useSaveResourcesMutation();
  const [getSelectedOrgs] = useLazyGetSelectedSocketDevOrganizationsQuery();

  const selectedOrgs = data.selectedOrgs || new Set<string>();

  const toggleOrg = (slug: string | number) => {
    const key = String(slug);
    const next = new Set(selectedOrgs);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setData({ selectedOrgs: next });
  };

  const handleSave = async () => {
    if (selectedOrgs.size === 0) {
      setErrors({ organizations: "Please select at least one organization" });
      return;
    }

    setLoading(true);
    setErrors({ organizations: "" });

    try {
      const startTime = Date.now();

      const selectedOrgObjects = data.organizations.filter((o) =>
        selectedOrgs.has(o.slug)
      );

      await saveResources({
        provider: "socketdev",
        connectionId: data.connectionId,
        resources: selectedOrgObjects,
      }).unwrap();

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      if (data.fromManage) {
        const result = await getSelectedOrgs("socketdev").unwrap();
        if (result.success) {
          setData({
            currentOrgs: result.organizations,
            selectedOrgs: new Set(),
          });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err: any) {
      setErrors({ organizations: err?.data?.error || err.message || "An error occurred" });
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
      resources={data.organizations.map((o) => ({ ...o, id: o.slug }))}
      selectedResources={selectedOrgs}
      onToggleResource={toggleOrg}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={errors.organizations || ""}
      title="Select the organizations you want to monitor."
      saveButtonLabel={`Save ${selectedOrgs.size} Organization${selectedOrgs.size !== 1 ? "s" : ""}`}
      renderResourceItem={(org) => (
        <div className="flex items-center gap-2">
          <Body>{org.name}</Body>
          {org.plan && (
            <span className="text-xs text-primary-500 dark:text-primary-600">
              {org.plan}
            </span>
          )}
        </div>
      )}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step: Manage Organizations
// ─────────────────────────────────────────────────────────────────────────────

function ManageOrgsStep({ onRevoke }: { onRevoke: () => void }) {
  const { data, setData, errors, setErrors, goTo } =
    useWizard<SocketDevWizardData>();
  const [loading, setLoading] = useState(false);

  const [deleteResource] = useDeleteResourceMutation();
  const [getOrganizations] = useLazyGetSocketDevOrganizationsQuery();
  const [getSelectedOrgs] = useLazyGetSelectedSocketDevOrganizationsQuery();

  const handleRemove = async (orgId: string) => {
    setErrors({ manage: "" });

    try {
      await deleteResource(orgId).unwrap();
      const result = await getSelectedOrgs("socketdev").unwrap();
      if (result.success) {
        setData({ currentOrgs: result.organizations });
      }
    } catch (err: any) {
      setErrors({ manage: err?.data?.error || err.message || "An error occurred" });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setErrors({ manage: "" });

    try {
      const orgsResult = await getOrganizations(data.connectionId).unwrap();

      if (!orgsResult.success) {
        throw new Error("Failed to fetch organizations");
      }

      const currentSlugs = new Set(data.currentOrgs.map((o) => o.slug));
      const availableOrgs = orgsResult.organizations.filter(
        (o: SocketDevOrganization) => !currentSlugs.has(o.slug)
      );

      if (availableOrgs.length === 0) {
        setErrors({ manage: "All organizations are already connected" });
        return;
      }

      setData({
        organizations: availableOrgs,
        selectedOrgs: new Set(),
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
      resources={data.currentOrgs}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={errors.manage || ""}
      resourceLabel="organization"
      resourceLabelPlural="organizations"
      addButtonLabel="Add Organization"
      revokeButtonLabel="Revoke Socket Access"
      renderResourceItem={(resource) => (
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Body>{resource.name}</Body>
            {resource.metadata?.plan && (
              <span className="text-xs text-primary-500 dark:text-primary-600">
                {resource.metadata.plan}
              </span>
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
  const { goTo } = useWizard<SocketDevWizardData>();

  useEffect(() => {
    if (targetStep && targetStep !== "loading") {
      goTo(targetStep);
    }
  }, [targetStep, goTo]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center space-y-3">
        <Muted className="shine-text">Loading organizations...</Muted>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function SocketDevModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: SocketDevModalProps) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  type InitState = { initializing: boolean; targetStep: StepId | null; data: Partial<SocketDevWizardData> };
  const [initState, setInitState] = useReducer(
    (_: InitState, next: InitState) => next,
    { initializing: true, targetStep: null, data: {} },
  );

  const [getSelectedOrgs] = useLazyGetSelectedSocketDevOrganizationsQuery();
  const [getConnection] = useLazyGetConnectionQuery();
  const [revokeConnection, { isLoading: isRevoking }] =
    useRevokeConnectionMutation();

  useEffect(() => {
    if (!open) {
      setInitState({ initializing: true, targetStep: null, data: {} });
      return;
    }

    const loadInitialData = async () => {
      const baseData: Partial<SocketDevWizardData> = {
        apiToken: "",
        organizations: [],
        selectedOrgs: new Set(),
        currentOrgs: [],
        isFirstConnection: false,
        fromManage: false,
      };

      let finalStep: StepId = "setToken";
      let finalData: Partial<SocketDevWizardData> = baseData;

      if (isConnected) {
        try {
          const startTime = Date.now();
          const result = await getSelectedOrgs("socketdev").unwrap();

          if (result.success) {
            finalData = {
              ...baseData,
              connectionId: result.connectionId,
              currentOrgs: result.organizations,
            };
            finalStep = "manage";
          } else {
            const connResult = await getConnection("socketdev").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentOrgs: [],
              };
              finalStep = "manage";
            }
          }

          const elapsed = Date.now() - startTime;
          const remainingTime = Math.max(0, 600 - elapsed);
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        } catch (err) {
          console.error("[loadInitialData] Error:", err);
          try {
            const connResult = await getConnection("socketdev").unwrap();
            if (connResult.success) {
              finalData = {
                ...baseData,
                connectionId: connResult.connection.id,
                currentOrgs: [],
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
  }, [open, isConnected, getSelectedOrgs, getConnection]);

  const handleClose = useCallback(() => {
    setShowRevokeConfirm(false);
    onClose();
  }, [onClose]);

  const handleRevoke = async () => {
    try {
      await revokeConnection("socketdev").unwrap();
      setShowRevokeConfirm(false);
      handleClose();
    } catch (err) {
      console.error("[handleRevoke] Error:", err);
      setShowRevokeConfirm(false);
      toast.error("Failed to revoke Socket access");
    }
  };

  const steps: WizardStep<SocketDevWizardData>[] = [
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
      render: () => <SelectOrgsStep onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageOrgsStep
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
        title="Socket"
        icon="connections/socketdev.png"
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName="Socket"
          description="This will disconnect all organizations and remove Socket.dev data. This action cannot be undone."
        />
      )}
    </>
  );
}
