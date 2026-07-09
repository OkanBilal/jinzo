import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AsciiSpinner, Button, toast } from "@/components/ui";
import {
  SettingsPageShell,
  SettingsSection,
  SettingsRow,
} from "./settings-layout";
import {
  useArchiveSpaceMutation,
  useGetProviderByIdQuery,
  useGetSpacesQuery,
  useSetActiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useUpdateProviderMutation,
  useUpdateProviderCliMutation,
} from "@/lib/redux/api";
import type { AccountInfo } from "@/lib/redux/api/providersApi";
import { getSpaceDefaultRoute } from "@/lib/route-utils";
import { extractErrorMessage } from "@/lib/extract-error-message";

type ProviderData = ReturnType<typeof useGetProviderByIdQuery>["data"];

export function useProviderSettings<TConfig extends object = Record<string, unknown>>(
  providerId: string,
  spaceSlug: string,
) {
  const navigate = useNavigate();
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery(providerId);
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();
  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();

  const space = spaces.find((s) => s.slug === spaceSlug);
  const otherVisibleSpaces = spaces.filter(
    (s) => s.slug !== spaceSlug && !s.isArchived,
  );
  const canHide = otherVisibleSpaces.length > 0;
  const config = (provider?.config ?? {}) as TConfig;

  const updateConfig = async (patch: Partial<TConfig>) => {
    if (!provider || updating) return false;
    try {
      await updateProvider({
        id: providerId,
        payload: { config: { ...config, ...patch } },
      }).unwrap();
      return true;
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to update setting"));
      return false;
    }
  };

  const setSpaceVisible = async (visible: boolean) => {
    if (!space) return;

    try {
      if (visible) {
        await unarchiveSpace(space.id).unwrap();
        toast.success("Space is now visible");
      } else {
        await archiveSpace(space.id).unwrap();
        const target = otherVisibleSpaces[0];
        if (target) {
          await setActiveSpace(target.id).unwrap();
          const route = getSpaceDefaultRoute(target);
          setTimeout(() => navigate(route, { replace: true }), 0);
        }
        toast.success("Space hidden");
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to update space visibility"));
    }
  };

  return {
    provider,
    isLoading,
    error,
    updating,
    config,
    space,
    canHide,
    updateConfig,
    setSpaceVisible,
  };
}

/**
 * CLI version + self-update section shared by every provider page.
 * Owns the update mutation and result message; per-provider bits come in as
 * props. Extra provider-specific rows (e.g. Cursor's outdated notice) render
 * below the update row via `children`.
 */
export function ProviderCliSection({
  providerId,
  cliName,
  shortName,
  cli,
  buttonVariant = "primary",
  children,
}: {
  providerId: string;
  /** Row title, e.g. "Claude Code CLI". */
  cliName: string;
  /** Used in the success message: "Claude" → "Claude CLI updated." */
  shortName: string;
  cli: AccountInfo["cli"];
  buttonVariant?: "primary" | "secondary";
  children?: ReactNode;
}) {
  const [updateCli, { isLoading: isUpdatingCli }] =
    useUpdateProviderCliMutation();
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const handleUpdateCli = async () => {
    setUpdateResult(null);
    try {
      const res = await updateCli(providerId).unwrap();
      setUpdateResult(
        res.success ? `${shortName} CLI updated.` : res.output || "Update failed.",
      );
    } catch {
      setUpdateResult("Update failed.");
    }
  };

  return (
    <SettingsSection title="CLI">
      <SettingsRow
        title={cliName}
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
            variant={buttonVariant}
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
      {children}
    </SettingsSection>
  );
}

/**
 * Account section shared by the provider pages. The page decides which
 * account type counts as "signed in" for its provider and passes the resolved
 * row content; this component owns the skeleton / API-key / signed-out states.
 */
export function ProviderAccountSection({
  isLoading,
  signedIn,
  isApiKey = false,
  notSignedInDescription,
}: {
  isLoading: boolean;
  /** Resolved row content when the provider-specific account type matched. */
  signedIn: { title: string; description: string; plan: string } | null;
  /** Providers that support API-key auth (Claude, Codex) pass this branch. */
  isApiKey?: boolean;
  notSignedInDescription: string;
}) {
  return (
    <SettingsSection title="Account">
      {isLoading ? (
        <div className="flex items-center justify-between py-4">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-40 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
            <div className="h-3 w-24 rounded bg-primary-200/30 dark:bg-primary-700/20 animate-pulse" />
          </div>
          <div className="h-4 w-12 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
        </div>
      ) : signedIn ? (
        <SettingsRow title={signedIn.title} description={signedIn.description}>
          <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
            {signedIn.plan}
          </span>
        </SettingsRow>
      ) : isApiKey ? (
        <SettingsRow title="Authentication" description="Connected via API key">
          <span className="text-sm text-primary-500 dark:text-primary-400">
            API Key
          </span>
        </SettingsRow>
      ) : (
        <SettingsRow title="Not signed in" description={notSignedInDescription}>
          <span className="text-xs text-primary-400 dark:text-primary-500">
            No account
          </span>
        </SettingsRow>
      )}
    </SettingsSection>
  );
}

export function formatResetDate(resetsAt: number): string {
  const date = new Date(resetsAt * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `Resets ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Resets ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export interface ProviderUsageRow {
  label: string;
  usedPercent: number;
  resetsAt?: number;
  used?: number;
  total?: number;
}

/**
 * One rate-limit row. `display` preserves the two existing presentations:
 * "remaining" (Codex — bar and text show what's left) and "used" (Copilot —
 * bar fills with usage, text shows counts when available).
 */
function UsageRateLimitRow({
  row,
  display,
}: {
  row: ProviderUsageRow;
  display: "remaining" | "used";
}) {
  const remaining = 100 - row.usedPercent;
  const hasCounts = typeof row.used === "number" && typeof row.total === "number";
  const barPercent = display === "remaining" ? remaining : row.usedPercent;

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {row.label}
        </span>
        {row.resetsAt && (
          <span className="text-xs text-primary-400 dark:text-primary-500">
            {formatResetDate(row.resetsAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="w-28 h-1.5 rounded-full bg-primary-200/50 dark:bg-primary-700/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-800 dark:bg-primary-200 transition-all duration-500"
            style={{ width: `${barPercent}%` }}
          />
        </div>
        {display === "remaining" ? (
          <span className="text-sm text-primary-500 dark:text-primary-400 w-16 text-right">
            {remaining}% left
          </span>
        ) : (
          <span className="text-sm text-primary-500 dark:text-primary-400 w-24 text-right tabular-nums">
            {hasCounts
              ? `${row.used!.toLocaleString()} / ${row.total!.toLocaleString()}`
              : `${row.usedPercent}% used`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Usage / rate-limit section shared by Codex and Copilot. */
export function ProviderUsageSection({
  isLoading,
  rows,
  display,
}: {
  isLoading: boolean;
  rows: ProviderUsageRow[];
  display: "remaining" | "used";
}) {
  return (
    <SettingsSection title="Usage">
      {isLoading ? (
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
      ) : rows.length > 0 ? (
        <div className="divide-y divide-primary-200/50 dark:divide-primary-800/20">
          {rows.map((row, i) => (
            <UsageRateLimitRow key={`${row.label}-${i}`} row={row} display={display} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-3">
          <span className="text-sm text-primary-400 dark:text-primary-500">
            No usage data available
          </span>
        </div>
      )}
    </SettingsSection>
  );
}

/** Display label for the currently selected structured-output schema. */
export function selectedSchemaLabel(config: {
  structuredOutputs?: Record<string, { name?: string }>;
  structuredOutputsSelectedId?: string | null;
}): string {
  const id = config.structuredOutputsSelectedId ?? null;
  if (!id) return "Off";
  return config.structuredOutputs?.[id]?.name ?? "Off";
}

export function ProviderSettingsLayout({
  title,
  provider,
  isLoading,
  error,
  children,
  className = "",
}: {
  title: string;
  provider: ProviderData;
  isLoading: boolean;
  error: unknown;
  children: ReactNode;
  className?: string;
}) {
  const missingProvider = !isLoading && !error && !provider;

  return (
    <SettingsPageShell
      title={title}
      isLoading={isLoading}
      error={error || missingProvider || undefined}
      errorMessage={`${title} provider not found. Make sure it is configured in the database.`}
      className={className}
    >
      {children}
    </SettingsPageShell>
  );
}
