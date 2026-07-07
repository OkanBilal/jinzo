import { ReactNode, useState } from "react";

import {
  Body,
  WizardModal,
  useWizard,
  type WizardStep,
} from "@/components/ui";
import {
  useLazyGetSelectedResourcesQuery,
  useSaveCredentialsMutation,
  useSaveResourcesMutation,
  useDeleteResourceMutation,
  useLazyGetConnectionQuery,
} from "@/lib/redux/api";
import { RevokeConfirmModal } from "./revoke-confirm-modal";
import { ManageResourcesStep } from "./manage-resources-step";
import { SelectResourcesStep } from "./select-resources-step";
import { CredentialStep } from "./credential-step";
import { AutoSyncSection } from "./auto-sync-section";
import { useConnectionModalState } from "./use-connection-modal-state";
import { ConnectionLoadingStep } from "./connection-loading-step";
import { extractErrorMessage } from "@/lib/extract-error-message";

const CRED_MIN_LOADING_MS = 800;
const SAVE_MIN_LOADING_MS = 1000;

async function withMinDelay<T>(work: Promise<T>, minMs: number): Promise<T> {
  const start = Date.now();
  const result = await work;
  const remaining = Math.max(0, minMs - (Date.now() - start));
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  return result;
}

export interface CredentialField {
  id: string;
  label: string;
  placeholder: string;
  /** Key in wizard data holding this field's value */
  dataKey: string;
  type?: "text" | "password" | "email";
  helperText?: string;
  required?: boolean;
  /** Custom validation error when field is empty */
  emptyError?: string;
}

export interface ResourceWizardConfig {
  provider: string;
  appName: string;
  modalTitle: string;
  icon: string;

  credentialDescription: string;
  credentialInstructions: ReactNode;
  credentialFields: CredentialField[];
  /** Build SaveCredentials payload extras (provider, connectionId added by wrapper) */
  buildCredentials: (values: Record<string, string>) => Record<string, string>;

  loadingMessage: string;
  selectTitle: string;
  resourceLabel: string;
  resourceLabelPlural: string;
  saveButtonLabel?: (count: number) => string;
  addButtonLabel?: string;
  revokeButtonLabel?: string;
  revokeDescription: string;

  /** Identity for items from "all available" list (used as React key + selection key) */
  identityForItem: (item: any) => string;
  /** Identity for items from "currently connected" list (used to filter dupes) */
  identityForCurrent: (current: any) => string;

  renderItemForSelect: (item: any) => ReactNode;
  renderItemForManage: (resource: any) => ReactNode;

  /** When set, renders <AutoSyncSection> under the manage list */
  autoSyncProviderLabel?: string;
}

interface WizardData {
  connectionId: string;
  items: any[];
  selectedIds: Set<string>;
  current: any[];
  isFirstConnection: boolean;
  fromManage: boolean;
  /** Last validation/submit error (single field, single message) */
  errorMessage: string;
  [credKey: string]: any;
}

interface ResourceWizardModalProps {
  open: boolean;
  onClose: () => void;
  isConnected: boolean;
  onSuccess?: () => void;
  config: ResourceWizardConfig;
  /** Provider-specific "fetch all" trigger; caller invokes the lazy hook. */
  fetchAllResources: (
    connectionId: string,
  ) => Promise<any[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Credentials step
// ─────────────────────────────────────────────────────────────────────────────

function CredentialsStep({
  config,
  fetchAllResources,
  onSuccess,
}: {
  config: ResourceWizardConfig;
  fetchAllResources: (
    connectionId: string,
  ) => Promise<any[]>;
  onSuccess?: () => void;
}) {
  const { data, setData, goTo } = useWizard<WizardData>();
  const [loading, setLoading] = useState(false);
  const [getConnection] = useLazyGetConnectionQuery();
  const [saveCredentials] = useSaveCredentialsMutation();

  const handleSubmit = async () => {
    for (const field of config.credentialFields) {
      const value = (data[field.dataKey] as string | undefined) ?? "";
      if (field.required === false) continue;
      if (!value.trim()) {
        setData({
          errorMessage:
            field.emptyError ?? `Please enter a valid ${field.label}`,
        });
        return;
      }
    }

    setLoading(true);
    setData({ errorMessage: "" });

    try {
      const work = (async () => {
        const connection = await getConnection(config.provider).unwrap();
        const connId = connection.id;

        const formValues: Record<string, string> = {};
        for (const field of config.credentialFields) {
          formValues[field.dataKey] =
            (data[field.dataKey] as string | undefined) ?? "";
        }

        await saveCredentials({
          provider: config.provider,
          connectionId: connId,
          ...config.buildCredentials(formValues),
        }).unwrap();

        onSuccess?.();

        const items = await fetchAllResources(connId);
        return { connId, items };
      })();

      const { connId, items } = await withMinDelay(work, CRED_MIN_LOADING_MS);

      setData({
        connectionId: connId,
        items,
        isFirstConnection: true,
        fromManage: false,
      });
      goTo("add");
    } catch (err) {
      console.error(`[${config.provider}] credentials submit:`, err);
      setData({
        errorMessage: extractErrorMessage(
          err,
          `Failed to connect to ${config.appName}.`,
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <CredentialStep
      description={config.credentialDescription}
      fields={config.credentialFields.map((field) => ({
        id: field.id,
        label: field.label,
        placeholder: field.placeholder,
        type: field.type,
        helperText: field.helperText,
        required: field.required,
        value: (data[field.dataKey] as string | undefined) ?? "",
        onChange: (value) => {
          setData({ [field.dataKey]: value, errorMessage: "" } as Partial<WizardData>);
        },
      }))}
      instructions={config.credentialInstructions}
      onSubmit={handleSubmit}
      loading={loading}
      error={data.errorMessage || ""}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Select step
// ─────────────────────────────────────────────────────────────────────────────

function SelectStep({
  config,
  onComplete,
}: {
  config: ResourceWizardConfig;
  onComplete: () => void;
}) {
  const { data, setData, goTo } = useWizard<WizardData>();
  const [loading, setLoading] = useState(false);
  const [saveResources] = useSaveResourcesMutation();
  const [getSelected] = useLazyGetSelectedResourcesQuery();

  const selectedIds = data.selectedIds || new Set<string>();

  const toggle = (id: string | number) => {
    const key = String(id);
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setData({ selectedIds: next });
  };

  const handleSave = async () => {
    if (selectedIds.size === 0) {
      setData({
        errorMessage: `Please select at least one ${config.resourceLabel}`,
      });
      return;
    }

    setLoading(true);
    setData({ errorMessage: "" });

    try {
      const work = (async () => {
        const selectedItems = data.items.filter((item) =>
          selectedIds.has(config.identityForItem(item)),
        );
        await saveResources({
          provider: config.provider,
          connectionId: data.connectionId,
          resources: selectedItems,
        }).unwrap();

        if (data.fromManage) {
          const result = await getSelected(config.provider).unwrap();
          return result.items;
        }
        return null;
      })();

      const refetched = await withMinDelay(work, SAVE_MIN_LOADING_MS);

      if (data.fromManage) {
        if (refetched) {
          setData({ current: refetched, selectedIds: new Set() });
        }
        goTo("manage");
      } else {
        onComplete();
      }
    } catch (err) {
      setData({ errorMessage: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (data.fromManage) goTo("manage");
    else if (data.isFirstConnection) onComplete();
    else goTo("setToken");
  };

  const saveLabel =
    config.saveButtonLabel?.(selectedIds.size) ??
    `Save ${selectedIds.size} ${selectedIds.size === 1 ? config.resourceLabel : config.resourceLabelPlural}`;

  return (
    <SelectResourcesStep
      resources={data.items.map((item) => ({
        ...item,
        id: config.identityForItem(item),
      }))}
      selectedResources={selectedIds}
      onToggleResource={toggle}
      onSave={handleSave}
      onBack={handleBack}
      loading={loading}
      error={data.errorMessage || ""}
      title={config.selectTitle}
      saveButtonLabel={saveLabel}
      renderResourceItem={(item) => config.renderItemForSelect(item)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage step
// ─────────────────────────────────────────────────────────────────────────────

function ManageStep({
  config,
  fetchAllResources,
  onRevoke,
}: {
  config: ResourceWizardConfig;
  fetchAllResources: (
    connectionId: string,
  ) => Promise<any[]>;
  onRevoke: () => void;
}) {
  const { data, setData, goTo } = useWizard<WizardData>();
  const [loading, setLoading] = useState(false);
  const [deleteResource] = useDeleteResourceMutation();
  const [getSelected] = useLazyGetSelectedResourcesQuery();

  const handleRemove = async (resourceId: string) => {
    setData({ errorMessage: "" });
    try {
      await deleteResource(resourceId).unwrap();
      const result = await getSelected(config.provider).unwrap();
      setData({ current: result.items });
    } catch (err) {
      setData({ errorMessage: extractErrorMessage(err) });
    }
  };

  const handleAddNew = async () => {
    setLoading(true);
    setData({ errorMessage: "" });
    try {
      const items = await fetchAllResources(data.connectionId);
      const currentIds = new Set(data.current.map(config.identityForCurrent));
      const available = items.filter(
        (item) => !currentIds.has(config.identityForItem(item)),
      );
      if (available.length === 0) {
        setData({
          errorMessage: `All ${config.resourceLabelPlural} are already connected`,
        });
        return;
      }
      setData({
        items: available,
        selectedIds: new Set(),
        fromManage: true,
      });
      goTo("add");
    } catch (err) {
      setData({ errorMessage: extractErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // ManageResourcesStep needs `name` on each item; re-shape current data so its
  // default render path works when no custom renderer is given.
  const reshaped = data.current.map((c) => ({ ...c, fullName: c.fullName ?? c.name }));

  return (
    <ManageResourcesStep
      resources={reshaped}
      onAddNew={handleAddNew}
      onRemove={handleRemove}
      onRevoke={onRevoke}
      loading={loading}
      error={data.errorMessage || ""}
      resourceLabel={config.resourceLabel}
      resourceLabelPlural={config.resourceLabelPlural}
      addButtonLabel={config.addButtonLabel ?? `Add ${capitalize(config.resourceLabel)}`}
      revokeButtonLabel={config.revokeButtonLabel ?? `Revoke ${config.appName} Access`}
      renderResourceItem={(resource) => config.renderItemForManage(resource)}
      extraContent={
        config.autoSyncProviderLabel ? (
          <AutoSyncSection
            provider={config.provider}
            providerLabel={config.autoSyncProviderLabel}
          />
        ) : undefined
      }
    />
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Wraps default Body row with muted gray for known fields (used by manage default).
export function DefaultManageRow({ children }: { children: ReactNode }) {
  return <Body>{children}</Body>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export function ResourceWizardModal({
  open,
  onClose,
  isConnected,
  onSuccess,
  config,
  fetchAllResources,
}: ResourceWizardModalProps) {
  const [getSelected] = useLazyGetSelectedResourcesQuery();

  const baseData: Partial<WizardData> = {
    connectionId: "",
    items: [],
    selectedIds: new Set<string>(),
    current: [],
    isFirstConnection: false,
    fromManage: false,
    errorMessage: "",
  };
  for (const field of config.credentialFields) {
    baseData[field.dataKey] = "";
  }

  const {
    initState,
    showRevokeConfirm,
    setShowRevokeConfirm,
    handleClose,
    handleRevoke,
    isRevoking,
  } = useConnectionModalState<WizardData>({
    open,
    onClose,
    isConnected,
    provider: config.provider,
    appName: config.appName,
    baseData,
    fetchSelected: async () => {
      const result = await getSelected(config.provider).unwrap();
      return {
        connectionId: result.connectionId,
        current: result.items,
      };
    },
  });

  const steps: WizardStep<WizardData>[] = [
    {
      id: "loading",
      render: () => (
        <ConnectionLoadingStep
          targetStep={initState.targetStep}
          message={config.loadingMessage}
        />
      ),
    },
    {
      id: "setToken",
      render: () => (
        <CredentialsStep
          config={config}
          fetchAllResources={fetchAllResources}
          onSuccess={onSuccess}
        />
      ),
    },
    {
      id: "add",
      render: () => <SelectStep config={config} onComplete={handleClose} />,
    },
    {
      id: "manage",
      render: () => (
        <ManageStep
          config={config}
          fetchAllResources={fetchAllResources}
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
        title={config.modalTitle}
        icon={config.icon}
        onCancel={handleClose}
      />

      {showRevokeConfirm && (
        <RevokeConfirmModal
          onConfirm={handleRevoke}
          onCancel={() => setShowRevokeConfirm(false)}
          loading={isRevoking}
          appName={config.appName}
          description={config.revokeDescription}
        />
      )}
    </>
  );
}
