import { useEffect, useState } from "react";
import { Toggle, Button, toast, Select, AsciiSpinner } from "@/components/ui";
import {
  SettingsSection,
  SettingsRow,
  SettingsDivider,
} from "./settings-layout";
import {
  useGetProviderRateLimitsQuery,
  useGetProviderAccountInfoQuery,
  useUpdateProviderCliMutation,
} from "@/lib/redux/api";
import { providersApi } from "@/lib/redux/api/providersApi";
import { useAppDispatch } from "@/lib/redux/hooks";
import type { RateLimitInfo } from "../../../../shared/adapter.types";
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { CodexAdapterConfig } from "../../../../shared/adapter.types";

type CodexApprovalMode = NonNullable<CodexAdapterConfig["approvalMode"]>;
type CodexPersonality = NonNullable<CodexAdapterConfig["personality"]>;
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import { CODEX_SANDBOX_MODES } from "@/lib/provider-modes";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";

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

const APPROVAL_OPTIONS: Array<{
  value: CodexApprovalMode;
  label: string;
  description: string;
}> = [
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

const PERSONALITY_OPTIONS: Array<{
  value: CodexPersonality;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "None",
    description: "No personality injected",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and conversational tone",
  },
  {
    value: "pragmatic",
    label: "Pragmatic",
    description: "Direct and practical tone",
  },
];

const SANDBOX_OPTIONS = CODEX_SANDBOX_MODES.map((m) => ({
  value: m.value,
  label: m.label,
  description: m.description,
}));

export default function CodexSettings() {
  const { provider, isLoading, error, config, updateConfig } =
    useProviderSettings<CodexAdapterConfig>(PROVIDER_IDS.codex, "codex");
  const { data: rateLimits, isLoading: isLoadingRateLimits } =
    useGetProviderRateLimitsQuery(PROVIDER_IDS.codex, {
      pollingInterval: 60000,
    });

  // Codex streams `account/rateLimits/updated` while a run is active; patch the
  // query cache so this panel reflects the fresh snapshot instead of waiting
  // for the 60s poll.
  const dispatch = useAppDispatch();
  useEffect(() => {
    const off = window.api.providers.onRateLimitsUpdated(
      ({ providerId, rateLimits: next }) => {
        if (providerId !== PROVIDER_IDS.codex || !next) return;
        dispatch(
          providersApi.util.updateQueryData(
            "getProviderRateLimits",
            PROVIDER_IDS.codex,
            () => next as RateLimitInfo,
          ),
        );
      },
    );
    return () => {
      off();
    };
  }, [dispatch]);
  const { data: accountInfo, isLoading: isLoadingAccount } =
    useGetProviderAccountInfoQuery(PROVIDER_IDS.codex);
  const cli = accountInfo?.cli;

  const [updateCli, { isLoading: isUpdatingCli }] =
    useUpdateProviderCliMutation();
  const [cliUpdateResult, setCliUpdateResult] = useState<string | null>(null);

  const handleUpdateCli = async () => {
    setCliUpdateResult(null);
    try {
      const res = await updateCli(PROVIDER_IDS.codex).unwrap();
      setCliUpdateResult(
        res.success ? "Codex CLI updated." : res.output || "Update failed.",
      );
    } catch {
      setCliUpdateResult("Update failed.");
    }
  };

  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] =
    useState(false);

  const approvalMode = config.approvalMode ?? "on-request";
  const sandboxMode = config.sandboxMode ?? "workspace-write";
  const networkAccessEnabled = config.networkAccessEnabled ?? true;
  const webSearchMode = config.webSearchMode ?? "live";
  const skipGitRepoCheck = config.skipGitRepoCheck ?? false;
  const personality = config.personality ?? "none";

  const structuredOutputs = config.structuredOutputs ?? {};
  const structuredOutputsSelectedId =
    config.structuredOutputsSelectedId ?? null;
  const selectedSchemaName = structuredOutputsSelectedId
    ? (structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off")
    : "Off";

  const account = accountInfo?.account;
  const planLabel =
    account?.type === "chatgpt"
      ? account.planType.charAt(0).toUpperCase() + account.planType.slice(1)
      : account?.type === "apiKey"
        ? "API Key"
        : null;

  return (
    <ProviderSettingsLayout
      title="Codex"
      provider={provider}
      isLoading={isLoading}
      error={error}
      className="pb-16"
    >
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
          <SettingsRow
            title="Not signed in"
            description="Sign in to Codex to view account details"
          >
            <span className="text-xs text-primary-400 dark:text-primary-500">
              No account
            </span>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* CLI version + self-update — `codex --version` / `codex update` */}
      <SettingsSection title="CLI">
        <SettingsRow
          title="Codex CLI"
          description={
            cli?.version ? `Version ${cli.version}` : "Version unknown"
          }
        >
          <div className="flex items-center gap-3">
            {cliUpdateResult && (
              <span className="text-xs text-primary-500 dark:text-primary-400">
                {cliUpdateResult}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUpdateCli}
              disabled={isUpdatingCli}
              className="gap-1 flex items-center"
            >
              {isUpdatingCli ? (
                <AsciiSpinner variant="null" kind="download" />
              ) : null}
              {isUpdatingCli ? "Updating…" : "Update CLI"}
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Configuration">
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
          title="Personality"
          description="Controls the agent's conversational style"
        >
          <Select
            value={personality}
            options={PERSONALITY_OPTIONS}
            onChange={(value) => {
              updateConfig({ personality: value });
              const label =
                PERSONALITY_OPTIONS.find((o) => o.value === value)?.label ??
                value;
              toast.success(`Personality: ${label}`);
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
            <span className="text-sm text-primary-400 dark:text-primary-500">
              No usage data available
            </span>
          </div>
        )}
      </SettingsSection>

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
        providerId={PROVIDER_IDS.codex}
      />
    </ProviderSettingsLayout>
  );
}
