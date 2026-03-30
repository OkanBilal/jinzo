import { useState } from "react";
import {
  Heading2,
  Muted,
  Toggle,
  Button,
  toast,
  Select,
} from "@/components/ui";
import {
  SettingsSection,
  SettingsRow,
  SettingsDivider,
} from "./settings-layout";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  useGetSpacesQuery,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useSetActiveSpaceMutation,
  useGetProviderRateLimitsQuery,
  useGetProviderAccountInfoQuery,
} from "@/lib/redux/api";
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

function formatResetDate(resetsAt: number): string {
  const date = new Date(resetsAt * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `Resets ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Resets ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function RateLimitRow({
  label,
  usedPercent,
  resetsAt,
}: {
  label: string;
  usedPercent: number;
  resetsAt?: number;
}) {
  const remaining = 100 - usedPercent;

  return (
    <div className="flex items-center justify-between  py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {label}
        </span>
        {resetsAt && (
          <span className="text-xs text-primary-400 dark:text-primary-500">
            {formatResetDate(resetsAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-28 h-1.5 rounded-full bg-primary-200/50 dark:bg-primary-700/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-800 dark:bg-primary-200 transition-all duration-500"
            style={{ width: `${remaining}%` }}
          />
        </div>
        <span className="text-sm text-primary-500 dark:text-primary-400 w-16 text-right">
          {remaining}% left
        </span>
      </div>
    </div>
  );
}

const APPROVAL_OPTIONS = [
  {
    value: "on-failure",
    label: "On Failure",
    description: "Ask only when a command fails",
  },
  {
    value: "on-request",
    label: "On Request",
    description: "Ask when escalation is requested",
  },
  {
    value: "untrusted",
    label: "Untrusted",
    description: "Always ask before taking action",
  },
  {
    value: "never",
    label: "Never",
    description: "Run without asking for approval",
  },
];

const SANDBOX_OPTIONS = [
  {
    value: "read-only",
    label: "Read Only",
    description: "Agent cannot modify files",
  },
  {
    value: "workspace-write",
    label: "Workspace Write",
    description: "Write within workspace only",
  },
  {
    value: "danger-full-access",
    label: "Full Access",
    description: "No restrictions",
  },
];

export default function CodexSettings() {
  const { data: provider, isLoading, error } = useGetProviderByIdQuery("codex");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();
  const { data: rateLimits, isLoading: isLoadingRateLimits } = useGetProviderRateLimitsQuery("codex", {
    pollingInterval: 60000,
  });
  const { data: accountInfo, isLoading: isLoadingAccount } = useGetProviderAccountInfoQuery("codex");

  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const codexSpace = spaces.find((s) => s.slug === "codex");
  const otherVisibleSpaces = spaces.filter(
    (s) => s.slug !== "codex" && !s.isArchived,
  );
  const canHide = otherVisibleSpaces.length > 0;

  // const [, setSearchParams] = useSearchParams();
  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] =
    useState(false);

  const config = provider?.config ?? {};
  const approvalMode = (config as any).approvalMode ?? "on-failure";
  const sandboxMode = (config as any).sandboxMode ?? "workspace-write";
  const networkAccessEnabled = (config as any).networkAccessEnabled ?? true;
  const webSearchMode = (config as any).webSearchMode ?? "live";
  const skipGitRepoCheck = (config as any).skipGitRepoCheck ?? false;

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

  const account = accountInfo?.account;
  const planLabel =
    account?.type === "chatgpt"
      ? account.planType.charAt(0).toUpperCase() + account.planType.slice(1)
      : account?.type === "apiKey"
        ? "API Key"
        : null;

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Codex</Heading2>
      </div>

      {/* Account info */}
      <SettingsSection title="Account">
        {isLoadingAccount ? (
          <div className="flex items-center justify-between  py-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
              <div className="h-3 w-24 rounded bg-primary-200/30 dark:bg-primary-700/20 animate-pulse" />
            </div>
            <div className="h-4 w-12 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
          </div>
        ) : account?.type === "chatgpt" ? (
          <SettingsRow title={account.email} description={account.type}>
            <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
              {planLabel}
            </span>
          </SettingsRow>
        ) : account?.type === "apiKey" ? (
          <SettingsRow
            title="Authentication"
            description="Connected via API key"
          >
            <span className="text-sm text-primary-500 dark:text-primary-400">
              API Key
            </span>
          </SettingsRow>
        ) : (
          <SettingsRow title="Not signed in" description="Sign in to Codex to view account details">
            <span className="text-xs text-primary-400 dark:text-primary-500">No account</span>
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsSection title="Configuration">

        {/*
        TODO:
        <SettingsRow
          title="Plugins"
          description="Browse and manage Codex plugins"
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => setSearchParams({ section: "codex-plugins" })}
          >
            Browse
          </Button>
        </SettingsRow>
        <SettingsDivider />*/}
        <SettingsRow
          title="Approval Policy"
          description="Choose when Codex asks for approval"
        >
          <Select
            value={approvalMode}
            options={APPROVAL_OPTIONS}
            onChange={(value) => {
              updateConfig({ approvalMode: value });
              const label =
                APPROVAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
              toast.success(`Approval: ${label}`);
            }}
            useFixedBackground
          />
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Sandbox Mode"
          description="Controls file and network isolation for the agent"
        >
          <Select
            value={sandboxMode}
            options={SANDBOX_OPTIONS}
            onChange={(value) => {
              updateConfig({ sandboxMode: value });
              const label =
                SANDBOX_OPTIONS.find((o) => o.value === value)?.label ?? value;
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
              toast.success(
                enabled ? "Network access enabled" : "Network access disabled",
              );
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
              toast.success(
                enabled ? "Web search enabled" : "Web search disabled",
              );
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
              toast.success(
                enabled ? "Git check skipped" : "Git check required",
              );
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
      {/* Rate limits */}
      <SettingsSection title="Usage">
        {isLoadingRateLimits ? (
          <div className="divide-y divide-primary-200/50 dark:divide-primary-800/20">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center justify-between py-4">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-36 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-primary-200/30 dark:bg-primary-700/20 animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-1.5 rounded-full bg-primary-200/50 dark:bg-primary-700/30" />
                  <div className="h-4 w-16 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : rateLimits && (rateLimits.primary || rateLimits.secondary) ? (
          <div className="divide-y divide-primary-200/50 dark:divide-primary-800/20">
            {rateLimits.primary && (
              <RateLimitRow
                label="5 hour usage limit"
                usedPercent={rateLimits.primary.usedPercent}
                resetsAt={rateLimits.primary.resetsAt}
              />
            )}
            {rateLimits.secondary && (
              <RateLimitRow
                label="Weekly usage limit"
                usedPercent={rateLimits.secondary.usedPercent}
                resetsAt={rateLimits.secondary.resetsAt}
              />
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <span className="text-sm text-primary-400 dark:text-primary-500">No usage data available</span>
          </div>
        )}
      </SettingsSection>

      {codexSpace && (
        <SettingsSection title="Visibility">
          <SettingsRow
            title="Show in Selector"
            description={
              !canHide && !codexSpace.isArchived
                ? "At least one agent must be active"
                : "Show or hide this agent from the selector"
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
                  toast.error(
                    err?.message || "Failed to update space visibility",
                  );
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
