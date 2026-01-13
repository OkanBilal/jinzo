import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { Button }  from "../../../components/ui/button";
import Select from "../../../components/ui/select";
import { Heading2, Muted } from "../../../components/ui/text";
import {
  AccountFormValues,
  AccountResponse,
  FieldProps,
} from "../../../features/settings/types/account";

// TODO Refactor default form values into a constant for reuse

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

export default function AccountSettings() {
  const [form, setForm] = useState<AccountFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
  const [isLocaleDropdownOpen, setIsLocaleDropdownOpen] = useState(false);

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
        err instanceof Error ? err.message : "An unexpected error occurred"
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
        const message = response.errors?.body || response.error || "Could not save";
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
        <Heading2 className="mb-1">Account</Heading2>
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
                Language & Time Settings
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Time Zone" htmlFor="timezone">
                <Select
                  value={form.timezone}
                  options={TIMEZONE_OPTIONS}
                  onChange={(val) => {
                    setForm((prev) => ({ ...prev, timezone: val }));
                    setIsDirty(true);
                  }}
                  isOpen={isTimezoneDropdownOpen}
                  onToggle={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
                  placeholder="Select timezone"
                />
              </Field>
              <Field label="Language" htmlFor="locale">
                <Select
                  value={form.locale}
                  options={LOCALE_OPTIONS}
                  onChange={(val) => {
                    setForm((prev) => ({ ...prev, locale: val }));
                    setIsDirty(true);
                  }}
                  isOpen={isLocaleDropdownOpen}
                  onToggle={() => setIsLocaleDropdownOpen(!isLocaleDropdownOpen)}
                  placeholder="Select language"
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-primary-100 dark:border-primary-900 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-primary-500 dark:text-primary-300">
              {lastSavedLabel
                ? `Last saved: ${lastSavedLabel}`
                : "Not saved yet"}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={fetchAccount}
                disabled={loading || saving}
              >
                Refresh
              </Button>
              <Button
                type="submit"
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
