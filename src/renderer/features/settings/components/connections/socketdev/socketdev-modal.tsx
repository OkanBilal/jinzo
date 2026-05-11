import { useState } from "react";

import { Body, WizardModal, useWizard, type WizardStep } from "@/components/ui";
import {
  useLazyGetConnectionQuery,
  useSaveCredentialsMutation,
  useLazyGetSocketDevOrganizationsQuery,
  useLazyGetSelectedSocketDevOrganizationsQuery,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  type SocketDevOrganization,
  type SelectedSocketDevOrganization,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "../shared/revoke-confirm-modal";
import { ManageResourcesStep } from "../shared/manage-resources-step";
import { SelectResourcesStep } from "../shared/select-resources-step";
import { CredentialStep } from "../shared/credential-step";
import { useConnectionModalState } from "../shared/use-connection-modal-state";
import { ConnectionLoadingStep } from "../shared/connection-loading-step";

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
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function SocketDevModal({
  open,
  onClose,
  isConnected,
  onSuccess,
}: SocketDevModalProps) {
  const [getSelectedOrgs] = useLazyGetSelectedSocketDevOrganizationsQuery();

  const { initState, showRevokeConfirm, setShowRevokeConfirm, handleClose, handleRevoke, isRevoking } =
    useConnectionModalState<SocketDevWizardData>({
      open,
      onClose,
      isConnected,
      provider: "socketdev",
      appName: "Socket",
      baseData: {
        apiToken: "",
        organizations: [],
        selectedOrgs: new Set(),
        currentOrgs: [],
        isFirstConnection: false,
        fromManage: false,
      },
      fetchSelected: async () => {
        const result = await getSelectedOrgs("socketdev").unwrap();
        if (!result.success) return null;
        return { connectionId: result.connectionId, currentOrgs: result.organizations };
      },
    });

  const steps: WizardStep<SocketDevWizardData>[] = [
    {
      id: "loading",
      render: () => (
        <ConnectionLoadingStep
          targetStep={initState.targetStep}
          message="Loading organizations..."
        />
      ),
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
      render: () => <ManageOrgsStep onRevoke={() => setShowRevokeConfirm(true)} />,
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
