import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { toast } from "@/components/ui/toast";
import { Button } from "../../../components/ui/button";
import { Input, Textarea } from "../../../components/ui/input";
import { Heading2 } from "../../../components/ui/text";
import { useGetAccountQuery, useUpdateAccountMutation } from "@/lib/redux/api";
import { SettingsRow, SettingsDivider } from "./settings-layout";

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
  const [isDirty, setIsDirty] = useState(false);
  
  const { data: account, isLoading: loading, error: queryError, refetch } = useGetAccountQuery();
  const [updateAccount, { isLoading: saving }] = useUpdateAccountMutation();
  
  const error = queryError ? 'Unable to load personalization details' : null;
  const lastSavedAt = account?.updatedAt || account?.createdAt || null;

  const [prevAccount, setPrevAccount] = useState(account);
  if (account !== prevAccount) {
    setPrevAccount(account);
    if (account) {
      setForm({
        displayName: account.displayName ?? "",
        email: account.email ?? "",
        company: account.company ?? "",
        jobTitle: account.jobTitle ?? "",
        website: account.website ?? "",
        avatarUrl: account.avatarUrl ?? "",
        bio: account.bio ?? "",
      });
      setIsDirty(false);
    }
  }

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

    try {
      const result = await updateAccount(form).unwrap();
      
      if (result.success && result.data) {
        setIsDirty(false);
        toast.success("Personalization updated");
      }
    } catch (err: any) {
      const message = err?.data?.error || err?.message || "A problem occurred while saving";
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
    <div className="space-y-2">
      <div className="mb-8">
        <Heading2>Personalization</Heading2>
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
        <form onSubmit={handleSubmit} className="space-y-0">
          <SettingsRow
            title="Display Name"
            description="Your name displayed across the app"
          >
            <Input
              id="displayName"
              value={form.displayName}
              onChange={handleChange("displayName")}
              disabled={saving}
              placeholder="e.g. Alex Smith"
            />
          </SettingsRow>

          <SettingsDivider />
          <SettingsRow title="Email" description="Used for notifications">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              disabled={saving}
              placeholder="you@example.com"
            />
          </SettingsRow>

          <SettingsDivider />

          <SettingsRow
            title="Company"
            description="Your organization or workplace"
          >
            <Input
              id="company"
              value={form.company}
              onChange={handleChange("company")}
              disabled={saving}
              placeholder="e.g. Laurel"
            />
          </SettingsRow>

          <SettingsDivider />

          <SettingsRow title="Job Title" description="Your role or position">
            <Input
              id="jobTitle"
              value={form.jobTitle}
              onChange={handleChange("jobTitle")}
              disabled={saving}
              placeholder="e.g. Product Lead"
            />
          </SettingsRow>

          <SettingsDivider />

          <SettingsRow
            title="Website"
            description="Your personal or company website"
          >
            <Input
              id="website"
              value={form.website}
              onChange={handleChange("website")}
              disabled={saving}
              placeholder="https://"
            />
          </SettingsRow>

          <SettingsDivider />

          <SettingsRow
            title="Avatar URL"
            description="Link to your profile picture"
          >
            <Input
              id="avatarUrl"
              value={form.avatarUrl}
              onChange={handleChange("avatarUrl")}
              disabled={saving}
              placeholder="https://cdn.example.com/me.png"
              className="min-w-80!"
            />
          </SettingsRow>

          <SettingsDivider />

          <SettingsRow
            title="Bio"
            description="Tell us a little about yourself"
          >
            <Textarea
              id="bio"
              className="resize-none w-80! h-16"
              value={form.bio}
              onChange={handleChange("bio")}
              disabled={saving}
              placeholder="A short description..."
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
                type="button"
                variant="ghost"
                onClick={() => refetch()}
                disabled={loading || saving}
              >
                Refresh
              </Button>
              <Button
                type="submit"
                disabled={!isDirty || saving}
                isLoading={saving}
                variant="submit"
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


