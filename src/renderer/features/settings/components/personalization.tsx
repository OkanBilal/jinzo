"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "../../../components/ui/button";
import { Input, Textarea } from "../../../components/ui/input";
import { Heading2, Muted } from "../../../components/ui/text";

interface PersonalizationFormValues {
  displayName: string;
  email: string;
  company: string;
  jobTitle: string;
  website: string;
  avatarUrl: string;
  bio: string;
}

interface PersonalizationResponse extends PersonalizationFormValues {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface FieldProps {
  label: string;
  description?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

const EMPTY_FORM: PersonalizationFormValues = {
  displayName: "",
  email: "",
  company: "",
  jobTitle: "",
  website: "",
  avatarUrl: "",
  bio: "",
};

export default function PersonalizationSettings() {
  const [form, setForm] = useState<PersonalizationFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const fetchAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load personalization details");
      }

      const data: PersonalizationResponse = await response.json();
      setForm({
        displayName: data.displayName ?? "",
        email: data.email ?? "",
        company: data.company ?? "",
        jobTitle: data.jobTitle ?? "",
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

  const handleChange =
    <T extends keyof PersonalizationFormValues>(field: T) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error || body?.errors?.body || "Could not save";
        throw new Error(message);
      }

      const updated: PersonalizationResponse = await response.json();
      setForm({
        displayName: updated.displayName ?? "",
        email: updated.email ?? "",
        company: updated.company ?? "",
        jobTitle: updated.jobTitle ?? "",
        website: updated.website ?? "",
        avatarUrl: updated.avatarUrl ?? "",
        bio: updated.bio ?? "",
      });
      setLastSavedAt(updated.updatedAt ?? updated.createdAt);
      setIsDirty(false);
      toast.success("Personalization updated");
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
        <Heading2 className="mb-1">Personalization</Heading2>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-primary-200/60 dark:border-primary-900 bg-white/50 dark:bg-primary-950/30 p-6 text-sm text-primary-600 dark:text-primary-200">
          Loading personalization...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-200">
                General Information
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              <Field
                label="Name"
                description="Displayed across the app"
                htmlFor="displayName"
              >
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={handleChange("displayName")}
                  disabled={saving}
                  placeholder="e.g. Alex Smith"
                />
              </Field>
              <Field
                label="Email"
                description="Used for notifications"
                htmlFor="email"
              >
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange("email")}
                  disabled={saving}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Company" htmlFor="company">
                <Input
                  id="company"
                  value={form.company}
                  onChange={handleChange("company")}
                  disabled={saving}
                  placeholder="e.g. Laurel"
                />
              </Field>
              <Field label="Job Title" htmlFor="jobTitle">
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange("jobTitle")}
                  disabled={saving}
                  placeholder="e.g. Product Lead"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-200">
                Profile Details
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Website" htmlFor="website">
                <Input
                  id="website"
                  value={form.website}
                  onChange={handleChange("website")}
                  disabled={saving}
                  placeholder="https://"
                />
              </Field>
              <Field label="Avatar URL" htmlFor="avatarUrl">
                <Input
                  id="avatarUrl"
                  value={form.avatarUrl}
                  onChange={handleChange("avatarUrl")}
                  disabled={saving}
                  placeholder="https://cdn.example.com/me.png"
                />
              </Field>
              <Field label="Bio" htmlFor="bio">
                <Textarea
                  id="bio"
                  className="resize-none"
                  value={form.bio}
                  onChange={handleChange("bio")}
                  disabled={saving}
                  placeholder="Tell us a little about yourself"
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
