import { useState } from "react";
import { Heading2, Muted, Toggle, Button, toast, Select } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  useGetSpacesQuery,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useSetActiveSpaceMutation,
} from "@/lib/redux/api";
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

const SANDBOX_OPTIONS = [
  { value: "read-only", label: "Read Only", description: "Agent cannot modify files" },
  { value: "workspace-write", label: "Workspace Write", description: "Write within workspace only" },
  { value: "danger-full-access", label: "Full Access", description: "No restrictions" },
];

export default function CodexSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("codex");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();

  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const codexSpace = spaces.find((s) => s.slug === "codex");
  const otherVisibleSpaces = spaces.filter((s) => s.slug !== "codex" && !s.isArchived);
  const canHide = otherVisibleSpaces.length > 0;

  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] = useState(false);

  const config = provider?.config ?? {};
  const sandboxMode = (config as any).sandboxMode ?? "workspace-write";
  const networkAccessEnabled = (config as any).networkAccessEnabled ?? true;
  const webSearchMode = (config as any).webSearchMode ?? "live";
  const skipGitRepoCheck = (config as any).skipGitRepoCheck ?? false;
  const showQuickActions = (config as any).showQuickActions !== false;

  const structuredOutputs = ((config as any).structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const structuredOutputsSelectedId =
    ((config as any).structuredOutputsSelectedId as string | null) ?? null;
  const selectedSchemaName = structuredOutputsSelectedId
    ? (structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off")
    : "Off";

  const updateConfig = async (patch: Record<string, unknown>) => {
    if (!provider || updating) return;
    try {
      await updateProvider({
        id: "codex",
        payload: { config: { ...config, ...patch } },
      }).unwrap();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update setting");
    }
  };

  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2">Codex</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div>
        <Heading2 className="mb-2">Codex</Heading2>
        <Muted>
          Codex provider not found. Make sure it is configured in the database.
        </Muted>
      </div>
    );
  }

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Codex</Heading2>
      </div>

      <SettingsSection>
        <SettingsRow
          title="Sandbox Mode"
          description="Controls file and network isolation for the agent"
        >
          <Select
            value={sandboxMode}
            options={SANDBOX_OPTIONS}
            onChange={(value) => {
              updateConfig({ sandboxMode: value });
              const label = SANDBOX_OPTIONS.find((o) => o.value === value)?.label ?? value;
              toast.success(`Sandbox: ${label}`);
            }}
            useFixedBackground
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Network Access"
          description="Allow network access within workspace-write sandbox mode"
        >
          <Toggle
            enabled={networkAccessEnabled}
            onChange={(enabled) => {
              updateConfig({ networkAccessEnabled: enabled });
              toast.success(enabled ? "Network access enabled" : "Network access disabled");
            }}
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Web Search"
          description="Allow the agent to search the web during runs"
        >
          <Toggle
            enabled={webSearchMode === "live"}
            onChange={(enabled) => {
              updateConfig({ webSearchMode: enabled ? "live" : "disabled" });
              toast.success(enabled ? "Web search enabled" : "Web search disabled");
            }}
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Skip Git Check"
          description="Allow running in non-git directories"
        >
          <Toggle
            enabled={skipGitRepoCheck}
            onChange={(enabled) => {
              updateConfig({ skipGitRepoCheck: enabled });
              toast.success(enabled ? "Git check skipped" : "Git check required");
            }}
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Structured Output"
          description="Define JSON Schemas to constrain the agent's output format"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-500 dark:text-primary-400">
              {selectedSchemaName}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStructuredOutputsModalOpen(true)}
            >
              Edit
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Workspace">
        <SettingsRow
          title="Quick Actions"
          description="Show quick action buttons in workspace"
        >
          <Toggle
            enabled={showQuickActions}
            onChange={(enabled) => {
              updateConfig({ showQuickActions: enabled });
              toast.success(enabled ? "Quick actions enabled" : "Quick actions hidden");
            }}
          />
        </SettingsRow>
      </SettingsSection>

      {codexSpace && (
        <SettingsSection title="Space">
          <SettingsRow
            title="Show in Sidebar"
            description={
              !canHide && !codexSpace.isArchived
                ? "At least one space must be visible"
                : "Show or hide this space from the sidebar"
            }
          >
            <Toggle
              enabled={!codexSpace.isArchived}
              disabled={!canHide && !codexSpace.isArchived}
              onChange={async (visible) => {
                try {
                  if (visible) {
                    await unarchiveSpace(codexSpace.id).unwrap();
                    toast.success("Space is now visible");
                  } else {
                    await archiveSpace(codexSpace.id).unwrap();
                    const target = otherVisibleSpaces[0];
                    if (target) {
                      await setActiveSpace(target.id).unwrap();
                    }
                    toast.success("Space hidden");
                  }
                } catch (err: any) {
                  toast.error(err?.message || "Failed to update space visibility");
                }
              }}
            />
          </SettingsRow>
        </SettingsSection>
      )}

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
        providerId="codex"
      />
    </div>
  );
}
