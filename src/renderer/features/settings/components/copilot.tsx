import { Toggle, Button, toast } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import { useGetProviderRateLimitsQuery } from "@/lib/redux/api";
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
  const {
    provider,
    isLoading,
    error,
    updating,
    config,
    updateConfig,
  } = useProviderSettings<CopilotAdapterConfig>(PROVIDER_IDS.copilot, "copilot");
  const permissionMode = config.permissionMode ?? "default";
  const isBypassing = permissionMode === "bypassPermissions";

  const { data: rateLimits, isLoading: isLoadingRateLimits } =
    useGetProviderRateLimitsQuery(PROVIDER_IDS.copilot, {
      pollingInterval: 60000,
    });

  const openPath = (targetPath: string) => {
    window.api.shell.openPath(targetPath);
  };

  const homedir = window.api.platform.homedir;

  const handlePermissionToggle = async (enabled: boolean) => {
    if (!provider || updating) return;

    const newMode = enabled ? "bypassPermissions" : "default";

    if (await updateConfig({ permissionMode: newMode })) {
      toast.success(
        enabled
          ? "Permission bypass enabled"
          : "Permission bypass disabled — tools will require approval",
      );
    }
  };

  return (
    <ProviderSettingsLayout
      title="Copilot"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      <SettingsSection  title="Configuration">
        <SettingsRow
          title="Bypass Permissions"
          description={
            <>
              <span className="text-amber-700 dark:text-amber-600 font-medium ">
                Enabling this gives the agent full control over file operations
                and terminal commands.
              </span>
            </>
          }
        >
          <Toggle enabled={isBypassing} onChange={handlePermissionToggle} />
        </SettingsRow>
      </SettingsSection>

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
            size="sm"
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
            size="sm"
            onClick={() => openPath(`${homedir}/.copilot/skills`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
      </SettingsSection>

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
