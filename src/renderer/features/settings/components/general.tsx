import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "@/components/toast";
import { useDarkMode } from "../../../hooks/useDarkMode";
import { useActiveMood } from "../../../hooks/useActiveMood";
import { Button } from "../../../components/ui/button";
import { Heading2, Muted } from "../../../components/ui/text";
import {
  AccountFormValues,
  AccountResponse,
  FieldProps,
} from "../../../features/settings/types/account";
import Select from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { defaultTheme } from "@/lib/theme";

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
  { value: "Europe/Istanbul", label: "Turkey (GMT+03:00)" },
  { value: "America/New_York", label: "New York (GMT-04:00)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-07:00)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+09:00)" },
];

const LOCALE_OPTIONS = [
  { value: "en-US", label: "English (US)" },
  { value: "tr-TR", label: "Turkish" },
  { value: "de-DE", label: "German" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
];

type ThemeValue = "light" | "dark" | "system";

// Theme Card Preview Component
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

  // Parse background - handle gradients and solid colors
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
        "flex flex-col items-center gap-2 cursor-pointer group active:scale-[0.98] hover:scale-[1.02] duration-200 transition-all",
      )}
    >
      {/* Preview Card */}
      <div
        className={cn(
          "relative w-32 h-24 rounded-xl overflow-hidden border-2 transition-all duration-200",
          isSelected
            ? "border-blue-500 ring-2 ring-blue-500/20"
            : "border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600",
        )}
      >
        {isAuto ? (
          // Auto/System theme - split view (sidebar + content for each half)
          <div className="w-full h-full flex">
            {/* Light half */}
            <div className="w-1/2 h-full flex">
              {/* Light Sidebar */}
              <div
                className={cn("w-5 h-full flex flex-col p-1 gap-1")}
                style={lightBgStyle}
              >
                <div className="w-2 h-2 bg-black/15 rounded-full" />
                <div className="w-full h-1 bg-black/10 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-black/10 rounded-full" />
              </div>
              {/* Light Main Content */}
              <div className="flex-1 h-full bg-primary-100 flex flex-col p-1.5">
                <div className="flex-1" />
                {/* Chat input */}
                <div className="w-full h-3 bg-primary-80  rounded-sm border border-black/10" />
              </div>
            </div>
            {/* Dark half */}
            <div className="w-1/2 h-full flex">
              {/* Dark Sidebar */}
              <div
                className={cn("w-5 h-full flex flex-col p-1 gap-1")}
                style={darkBgStyle}
              >
                <div className="w-2 h-2 bg-white/20 rounded-full" />
                <div className="w-full h-1 bg-white/15 rounded-full mt-1" />
                <div className="w-2/3 h-1 bg-white/15 rounded-full" />
              </div>
              {/* Dark Main Content */}
              <div className="flex-1 h-full flex bg-primary-950 flex-col p-1.5">
                <div className="flex-1" />
                {/* Chat input */}
                <div className="w-full h-3 bg-white/10 rounded-sm flex items-center justify-end pr-0.5"></div>
              </div>
            </div>
          </div>
        ) : (
          // Light or Dark theme - full view with sidebar layout
          <div className="w-full h-full flex">
            {/* Sidebar */}
            <div
              className={cn("w-8 h-full flex flex-col p-1.5 gap-1")}
              style={isLight ? lightBgStyle : darkBgStyle}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isLight ? "bg-black/15" : "bg-white/20",
                )}
              />
              {/* Menu items */}
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
            {/* Main Content */}
            <div
              className={`flex-1 h-full flex flex-col p-2 ${isLight ? "bg-primary-100" : "bg-primary-950"}`}
            >
              {/* Content area */}
              <div className="flex-1" />
              {/* Chat input bar */}
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
      {/* Label */}
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

export default function GeneralSettings() {
  const { theme, setTheme } = useDarkMode();
  const { activeMood } = useActiveMood();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<AccountFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Parse active mood's theme config for preview backgrounds
  const { lightBackground, darkBackground } = useMemo(() => {
    if (!activeMood?.themeConfig) {
      return {
        lightBackground: defaultTheme.lightBackground.replace(
          /[0-9a-f]{2}$/i,
          "",
        ), // Remove alpha
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
    setMounted(true);
  }, []);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.api.account.get();

      if (!response.success) {
        throw new Error(response.error || "Unable to load account details");
      }

      const data = response.data as AccountResponse;
      setForm({
        displayName: data.displayName ?? "",
        email: data.email ?? "",
        company: data.company ?? "",
        jobTitle: data.jobTitle ?? "",
        timezone: data.timezone ?? "UTC",
        locale: data.locale ?? "en-US",
        website: data.website ?? "",
        avatarUrl: data.avatarUrl ?? "",
        bio: data.bio ?? "",
      });
      setLastSavedAt(data.updatedAt ?? data.createdAt);
      setIsDirty(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await window.api.account.update(form);

      if (!response.success) {
        const message =
          response.errors?.body || response.error || "Could not save";
        throw new Error(message);
      }

      const updated = response.data as AccountResponse;
      setForm({
        displayName: updated.displayName ?? "",
        email: updated.email ?? "",
        company: updated.company ?? "",
        jobTitle: updated.jobTitle ?? "",
        timezone: updated.timezone ?? "UTC",
        locale: updated.locale ?? "en-US",
        website: updated.website ?? "",
        avatarUrl: updated.avatarUrl ?? "",
        bio: updated.bio ?? "",
      });
      setLastSavedAt(updated.updatedAt ?? updated.createdAt);
      setIsDirty(false);
      toast.success("Account details updated");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "A problem occurred while saving";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const lastSavedLabel = useMemo(() => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }, [lastSavedAt]);

  return (
    <div className="space-y-6">
      <div>
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
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-200">
                Appearance
              </h3>
              <p className="text-xs text-primary-500 dark:text-primary-400 mt-1">
                Color mode
              </p>
            </div>
            <div className="flex gap-4">
              {mounted ? (
                <>
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
                </>
              ) : (
                <div className="flex gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <div className="w-32 h-24 rounded-xl bg-primary-100 dark:bg-primary-800 animate-pulse" />
                      <div className="w-12 h-4 rounded bg-primary-100 dark:bg-primary-800 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-200">
                Language & Time Settings
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Tıme Zone" htmlFor="timezone">
                <Select
                  useFixedBackground={true}
                  value={form.timezone}
                  options={TIMEZONE_OPTIONS}
                  onChange={(val) => {
                    setForm((prev) => ({ ...prev, timezone: val }));
                    setIsDirty(true);
                  }}
                  placeholder="Select timezone"
                />
              </Field>
              <Field label="Language" htmlFor="locale">
                <Select
                  useFixedBackground={true}
                  value={form.locale}
                  options={LOCALE_OPTIONS}
                  onChange={(val) => {
                    setForm((prev) => ({ ...prev, locale: val }));
                    setIsDirty(true);
                  }}
                  placeholder="Select language"
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-col gap-3 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-primary-500 dark:text-primary-300">
              {lastSavedLabel
                ? `Last saved: ${lastSavedLabel}`
                : "Not saved yet"}
            </div>
            <div className="flex items-center gap-3">
              <Button
                tooltip="Refresh account details"
                type="button"
                variant="ghost"
                onClick={fetchAccount}
                disabled={loading || saving}
              >
                Refresh
              </Button>
              <Button
                type="submit"
                size="md"
                variant="primary"
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

function Field({
  label,
  description,
  htmlFor,
  className = "",
  children,
}: FieldProps) {
  return (
    <label className={`space-y-1.5 ${className}`} htmlFor={htmlFor}>
      <span className="text-xs font-medium uppercase tracking-wide text-primary-500 dark:text-primary-300">
        {label}
      </span>
      {description && <Muted className="text-[11px]">{description}</Muted>}
      {children}
    </label>
  );
}
