import { useState } from "react";
import { AsciiSpinner, Button, Select } from "@/components/ui";
import { SettingsSection, SettingsRow } from "./settings-layout";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import type { CursorAdapterConfig } from "../../../../shared/adapter.types";
import { CURSOR_MODES } from "@/lib/provider-modes";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";
import {
  useGetProviderAccountInfoQuery,
  useUpdateProviderCliMutation,
} from "@/lib/redux/api/providersApi";

export default function CursorSettings(
) {
  const {
    provider,
    isLoading,
    error,
    config,
    updateConfig,
  } = useProviderSettings<CursorAdapterConfig>(PROVIDER_IDS.cursor, "cursor");
  const mode = config.mode ?? "agent";

  const { data: accountInfo, isLoading: isLoadingAccount } =
    useGetProviderAccountInfoQuery(PROVIDER_IDS.cursor);
  const account = accountInfo?.account;
  const cli = accountInfo?.cli;

  const [updateCli, { isLoading: isUpdating }] = useUpdateProviderCliMutation();
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const handleUpdateCli = async () => {
    setUpdateResult(null);
    try {
      const res = await updateCli(PROVIDER_IDS.cursor).unwrap();
      setUpdateResult(res.success ? "Cursor CLI updated." : res.output || "Update failed.");
    } catch {
      setUpdateResult("Update failed.");
    }
  };

  return (
    <ProviderSettingsLayout
      title="Cursor"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      {/* Account info — from `agent about` */}
      <SettingsSection title="Account">
        {isLoadingAccount ? (
          <div className="flex items-center justify-between py-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
              <div className="h-3 w-24 rounded bg-primary-200/30 dark:bg-primary-700/20 animate-pulse" />
            </div>
            <div className="h-4 w-12 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
          </div>
        ) : account?.type === "cursor" ? (
          <SettingsRow title={account.email} description="Signed in">
            <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
              {account.planType || "Cursor"}
            </span>
          </SettingsRow>
        ) : (
          <SettingsRow
            title="Not signed in"
            description="Run `agent login` in your terminal to authenticate"
          >
            <span className="text-xs text-primary-400 dark:text-primary-500">
              No account
            </span>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* CLI version + self-update — `agent about` / `agent update` */}
      <SettingsSection title="CLI">
        <SettingsRow
          title="Cursor Agent CLI"
          description={
            cli?.version
              ? `Version ${cli.version}${cli.channel ? ` · ${cli.channel} channel` : ""}`
              : "Version unknown"
          }
        >
          <div className="flex items-center gap-3">
            {updateResult && (
              <span className="text-xs text-primary-500 dark:text-primary-400">
                {updateResult}
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleUpdateCli}
              disabled={isUpdating}
              className="gap-1 flex items-center"
            >
              {isUpdating ? (
                <AsciiSpinner variant="null" kind="download" />
              ) : null}
              {isUpdating ? "Updating…" : "Update CLI"}
            </Button>
          </div>
        </SettingsRow>
        {cli?.outdated && (
          <SettingsRow
            title="Update recommended"
            description="This CLI is too old for model effort controls. Update to enable them."
          >
            <span className="text-xs text-amber-500">Outdated</span>
          </SettingsRow>
        )}
      </SettingsSection>

      <SettingsSection title="Configuration">
        <SettingsRow title="Mode" description="How Cursor operates during runs">
          <Select
            value={mode}
            onChange={(value) =>
              updateConfig({ mode: value as CursorAdapterConfig["mode"] })
            }
            options={CURSOR_MODES.map((m) => ({
              value: m.value,
              label: m.label,
              description: m.description,
            }))}
          />
        </SettingsRow>
      </SettingsSection>
    </ProviderSettingsLayout>
  );
}
