import { useState } from "react";
import { Button, AsciiSpinner } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import { useCapabilities } from "@/lib/platform";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import {
  useGetProviderRateLimitsQuery,
  useGetProviderAccountInfoQuery,
  useUpdateProviderCliMutation,
} from "@/lib/redux/api";
import type { CopilotAdapterConfig } from "../../../../shared/adapter.types";
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
  used,
  total,
}: {
  label: string;
  usedPercent: number;
  resetsAt?: number;
  used?: number;
  total?: number;
}) {
  const hasCounts = typeof used === "number" && typeof total === "number";
  return (
    <div className="flex items-center justify-between py-3">
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
        {/* Bar fills with usage (used proportion). */}
        <div className="w-28 h-1.5 rounded-full bg-primary-200/50 dark:bg-primary-700/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-800 dark:bg-primary-200 transition-all duration-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <span className="text-sm text-primary-500 dark:text-primary-400 w-24 text-right tabular-nums">
          {hasCounts
            ? `${used!.toLocaleString()} / ${total!.toLocaleString()}`
            : `${usedPercent}% used`}
        </span>
      </div>
    </div>
  );
}

export default function CopilotSettings(
) {
  const { provider, isLoading, error } = useProviderSettings<CopilotAdapterConfig>(
    PROVIDER_IDS.copilot,
    "copilot",
  );

  const { data: rateLimits, isLoading: isLoadingRateLimits } =
    useGetProviderRateLimitsQuery(PROVIDER_IDS.copilot, {
      pollingInterval: 60000,
    });

  const { data: accountInfo } = useGetProviderAccountInfoQuery(
    PROVIDER_IDS.copilot,
  );
  const cli = accountInfo?.cli;

  const [updateCli, { isLoading: isUpdatingCli }] =
    useUpdateProviderCliMutation();
  const [cliUpdateResult, setCliUpdateResult] = useState<string | null>(null);

  const handleUpdateCli = async () => {
    setCliUpdateResult(null);
    try {
      const res = await updateCli(PROVIDER_IDS.copilot).unwrap();
      setCliUpdateResult(
        res.success ? "Copilot CLI updated." : res.output || "Update failed.",
      );
    } catch {
      setCliUpdateResult("Update failed.");
    }
  };

  const openPath = (targetPath: string) => {
    window.api.shell.openPath(targetPath);
  };

  const homedir = window.api.platform.homedir;
  const { revealInFolder } = useCapabilities();

  return (
    <ProviderSettingsLayout
      title="Copilot"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      {/* CLI version + self-update — `copilot --version` / `copilot update` */}
      <SettingsSection title="CLI">
        <SettingsRow
          title="GitHub Copilot CLI"
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

      {revealInFolder && (
        <SettingsSection title="Capabilities">
        <SettingsRow
          title="Agents"
          description={
            <>
              Define custom agents as markdown files in ~/.copilot/agents/ (user)
              or .github/agents/ (project).
            </>
          }
        >
          <Button
            variant="primary"
            onClick={() => openPath(`${homedir}/.copilot/agents`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Skills"
          description={
            <>
              SKILL.md files that extend Copilot&apos;s capabilities. Copilot
              reads from ~/.claude/skills/ (shared with Claude), ~/.copilot/skills/
              (user), and .github/skills/ (project).
            </>
          }
        >
          <Button
            variant="primary"
            onClick={() => openPath(`${homedir}/.copilot/skills`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
        </SettingsSection>
      )}

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
                label={rateLimits.primary.label ?? "Primary"}
                usedPercent={rateLimits.primary.usedPercent}
                resetsAt={rateLimits.primary.resetsAt}
                used={rateLimits.primary.used}
                total={rateLimits.primary.total}
              />
            )}
            {rateLimits.secondary && (
              <RateLimitRow
                label={rateLimits.secondary.label ?? "Secondary"}
                usedPercent={rateLimits.secondary.usedPercent}
                resetsAt={rateLimits.secondary.resetsAt}
                used={rateLimits.secondary.used}
                total={rateLimits.secondary.total}
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
    </ProviderSettingsLayout>
  );
}
