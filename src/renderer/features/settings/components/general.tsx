import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "@/components/ui/toast";
import { useDarkMode } from "../../../hooks/use-dark-mode";
import { useActiveMood } from "../../../hooks/use-active-mood";
import { Button } from "../../../components/ui/button";
import { Heading2 } from "../../../components/ui/text";
import { AccountFormValues } from "../../../features/settings/types/account";
import Select from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { defaultTheme } from "@/lib/theme";
import { useGetAccountQuery, useUpdateAccountMutation } from "@/lib/redux/api";
import { SettingsRow, SettingsDivider } from "./settings-layout";
import { useAutoUpdate } from "@/hooks/use-auto-update";

export const EMPTY_FORM = {
  displayName: "",
  email: "",
  company: "",
  jobTitle: "",
  timezone: "UTC",
  locale: "en-US",
  website: "",
  avatarUrl: "",
  bio: "",
};

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT+00:00)" },
  { value: "Europe/Paris", label: "Paris (GMT+01:00)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+01:00)" },
  { value: "Europe/Istanbul", label: "Turkey (GMT+03:00)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+04:00)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+08:00)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+09:00)" },
  { value: "Australia/Sydney", label: "Sydney (GMT+10:00)" },
  { value: "America/New_York", label: "New York (GMT-05:00)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-08:00)" },
];

const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "tr-TR", label: "Turkish" },
  { value: "de-DE", label: "German" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
  { value: "ru-RU", label: "Russian" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "it-IT", label: "Italian" },
  { value: "nl-NL", label: "Dutch" },
  { value: "sv-SE", label: "Swedish" },
];

type ThemeValue = "light" | "dark" | "system";

function ThemePreviewCard({
  themeValue,
  label,
  isSelected,
  onClick,
  lightBackground,
  darkBackground,
}: {
  themeValue: ThemeValue;
  label: string;
  isSelected: boolean;
  onClick: () => void;
  lightBackground: string;
  darkBackground: string;
}) {
  const isLight = themeValue === "light";
  const isAuto = themeValue === "system";

  const getBackgroundStyle = (bg: string) => {
    if (bg.startsWith("linear-gradient")) {
      return { background: bg };
    }
    return { backgroundColor: bg };
  };

  const lightBgStyle = getBackgroundStyle(lightBackground);
  const darkBgStyle = getBackgroundStyle(darkBackground);

  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 cursor-pointer group active:scale-99 hover:scale-101 duration-200 transition-all",
      )}
    >
      <div
        className={cn(
          "relative w-32 h-24 rounded-xl overflow-hidden border-2 transition-all duration-200",
          isSelected
            ? "border-blue-500 ring-2 ring-blue-500/20"
            : "border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600",
        )}
      >
        {isAuto ? (
          <div className="w-full h-full flex">
            <div className="w-1/2 h-full flex">
              <div
                className={cn("w-5 h-full flex flex-col p-1 gap-1")}
                style={lightBgStyle}
              >
                <div className="w-2 h-2 bg-black/15 rounded-full" />
                <div className="w-full h-1 bg-black/10 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-black/10 rounded-full" />
              </div>
              <div className="flex-1 h-full bg-primary-100 flex flex-col p-1.5">
                <div className="flex-1" />
                <div className="w-full h-3 bg-primary-80  rounded-sm border border-black/10" />
              </div>
            </div>
            <div className="w-1/2 h-full flex">
              <div
                className={cn("w-5 h-full flex flex-col p-1 gap-1")}
                style={darkBgStyle}
              >
                <div className="w-2 h-2 bg-white/20 rounded-full" />
                <div className="w-full h-1 bg-white/15 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-white/15 rounded-full" />
              </div>
              <div className="flex-1 h-full flex bg-primary-950 flex-col p-1.5">
                <div className="flex-1" />
                <div className="w-full h-3 bg-white/10 rounded-sm flex items-center justify-end pr-0.5"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex">
            <div
              className={cn("w-8 h-full flex flex-col p-1.5 gap-1")}
              style={isLight ? lightBgStyle : darkBgStyle}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLight ? "bg-black/15" : "bg-white/20",
                )}
              />
              <div className="flex flex-col gap-0.5 mt-1">
                <div
                  className={cn(
                    "w-full h-1 rounded-full",
                    isLight ? "bg-black/10" : "bg-white/15",
                  )}
                />
                <div
                  className={cn(
                    "w-4/5 h-1 rounded-full",
                    isLight ? "bg-black/10" : "bg-white/15",
                  )}
                />
              </div>
            </div>
            <div
              className={`flex-1 h-full flex flex-col p-2 ${isLight ? "bg-primary-100" : "bg-primary-950"}`}
            >
              <div className="flex-1" />
              <div
                className={cn(
                  "w-full h-4 rounded-md flex items-center px-1",
                  isLight
                    ? "bg-white/80 border border-black/10"
                    : "bg-white/10",
                )}
              ></div>
            </div>
          </div>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          isSelected
            ? "text-primary-900 dark:text-primary-100"
            : "text-primary-500 dark:text-primary-400 group-hover:text-primary-700 dark:group-hover:text-primary-300",
        )}
      >
        {label}
      </span>
    </Button>
  );
}

function UpdateButton({
  state,
  onCheck,
  onDownload,
  onInstall,
}: {
  state: { status: string; info: any; progress: any; error: string | null };
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}) {
  switch (state.status) {
    case "checking":
      return (
        <Button type="button" variant="ghost" disabled isLoading>
          Checking...
        </Button>
      );
    case "available":
      return (
        <Button type="button" variant="submit" size="md" onClick={onDownload}>
          Download v{state.info?.version}
        </Button>
      );
    case "downloading":
      return (
        <div className="flex items-center gap-3">
          <div className="w-32 h-2 bg-primary-200 dark:bg-primary-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(state.progress?.percent ?? 0)}%` }}
            />
          </div>
          <span className="text-xs text-primary-500 dark:text-primary-400 tabular-nums">
            {Math.round(state.progress?.percent ?? 0)}%
          </span>
        </div>
      );
    case "downloaded":
      return (
        <Button type="button" variant="submit" size="md" onClick={onInstall}>
          Restart &amp; Install
        </Button>
      );
    case "error":
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-500">{state.error}</span>
          <Button type="button" variant="ghost" size="md" onClick={onCheck}>
            Retry
          </Button>
        </div>
      );
    case "not-available":
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary-500 dark:text-primary-400">
            Up to date
          </span>
          <Button type="button" variant="ghost" size="md" onClick={onCheck}>
            Check Again
          </Button>
        </div>
      );
    default:
      return (
        <Button type="button" variant="ghost" size="md" onClick={onCheck}>
          Check for Updates
        </Button>
      );
  }
}

export default function GeneralSettings() {
  const { theme, setTheme } = useDarkMode();
  const { activeMood } = useActiveMood();
  const { state: updateState, check: checkUpdate, download: downloadUpdate, install: installUpdate } = useAutoUpdate();
  const [form, setForm] = useState<AccountFormValues>(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);

  const {
    data: account,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useGetAccountQuery();
  const [updateAccount, { isLoading: saving }] = useUpdateAccountMutation();

  const error = queryError ? "Unable to load account details" : null;
  const lastSavedAt = account?.updatedAt || account?.createdAt || null;

  const { lightBackground, darkBackground } = useMemo(() => {
    if (!activeMood?.themeConfig) {
      return {
        lightBackground: defaultTheme.lightBackground.replace(
          /[0-9a-f]{2}$/i,
          "",
        ),
        darkBackground: defaultTheme.darkBackground.replace(
          /[0-9a-f]{2}$/i,
          "",
        ),
      };
    }
    try {
      const config = JSON.parse(activeMood.themeConfig);
      return {
        lightBackground: config.lightBackground || "#f5f3ee",
        darkBackground: config.darkBackground || "#1a1a1a",
      };
    } catch {
      return {
        lightBackground: "#f5f3ee",
        darkBackground: "#1a1a1a",
      };
    }
  }, [activeMood?.themeConfig]);

  useEffect(() => {
    if (account) {
      setForm({
        displayName: account.displayName ?? "",
        email: account.email ?? "",
        company: account.company ?? "",
        jobTitle: account.jobTitle ?? "",
        timezone: account.timezone ?? "UTC",
        locale: account.locale ?? "en-US",
        website: account.website ?? "",
        avatarUrl: account.avatarUrl ?? "",
        bio: account.bio ?? "",
      });
      setIsDirty(false);
    }
  }, [account]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    try {
      const result = await updateAccount(form).unwrap();

      if (result.success && result.data) {
        setIsDirty(false);
        toast.success("Account details updated");
      }
    } catch (err: any) {
      const message =
        err?.data?.error || err?.message || "A problem occurred while saving";
      toast.error(message);
    }
  };

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [lastSavedAt]);

  return (
    <div className="space-y-2 bg-primary dark:bg-primary-950 ">
      <div className="mb-8">
        <Heading2>General</Heading2>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-primary-200/60 dark:border-primary-900 bg-white/50 dark:bg-primary-950/30 p-6 text-sm text-primary-600 dark:text-primary-200">
          Loading account information...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-0">
          <SettingsRow
            title="Appearance"
            description="Choose your preferred color mode"
          >
            <div className="flex gap-3">
                  <ThemePreviewCard
                    themeValue="light"
                    label="Light"
                    isSelected={theme === "light"}
                    lightBackground={lightBackground}
                    darkBackground={darkBackground}
                    onClick={() => {
                      setTheme("light");
                      toast.success("Theme changed to Light");
                    }}
                  />
                  <ThemePreviewCard
                    themeValue="system"
                    label="Auto"
                    isSelected={theme === "system"}
                    lightBackground={lightBackground}
                    darkBackground={darkBackground}
                    onClick={() => {
                      setTheme("system");
                      toast.success("Theme changed to Auto");
                    }}
                  />
                  <ThemePreviewCard
                    themeValue="dark"
                    label="Dark"
                    isSelected={theme === "dark"}
                    lightBackground={lightBackground}
                    darkBackground={darkBackground}
                    onClick={() => {
                      setTheme("dark");
                      toast.success("Theme changed to Dark");
                    }}
                  />
            </div>
          </SettingsRow>

          <SettingsDivider />
          <SettingsRow
            title="Time Zone"
            description="Set your local timezone for accurate scheduling"
          >
            <Select
              useFixedBackground={true}
              value={form.timezone}
              options={TIMEZONE_OPTIONS}
              onChange={(val) => {
                setForm((prev: any) => ({ ...prev, timezone: val }));
                setIsDirty(true);
              }}
              placeholder="Select timezone"
            />
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow
            title="Language"
            description="Choose your preferred language"
          >
            <Select
              useFixedBackground={true}
              value={form.locale}
              options={LOCALE_OPTIONS}
              onChange={(val) => {
                setForm((prev: any) => ({ ...prev, locale: val }));
                setIsDirty(true);
              }}
              placeholder="Select language"
            />
          </SettingsRow>

          <SettingsDivider />
          <SettingsRow
            title="Software Updates"
            description={`Current version: v${__APP_VERSION__ ?? "1.0.0"}`}
          >
            <UpdateButton
              state={updateState}
              onCheck={checkUpdate}
              onDownload={downloadUpdate}
              onInstall={installUpdate}
            />
          </SettingsRow>

          <SettingsDivider />
          <div className="flex items-center justify-between pt-6">
            <div className="text-xs text-primary-500 dark:text-primary-400">
              {lastSavedLabel
                ? `Last saved: ${lastSavedLabel}`
                : "Not saved yet"}
            </div>
            <div className="flex items-center gap-3">
              <Button
                tooltip="Refresh account details"
                type="button"
                variant="ghost"
                onClick={() => refetch()}
                disabled={loading || saving}
              >
                Refresh
              </Button>
              <Button
                type="submit"
                size="md"
                variant="submit"
                disabled={!isDirty || saving}
                isLoading={saving}
              >
                Save
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}


