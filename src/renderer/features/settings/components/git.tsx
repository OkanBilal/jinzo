import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { toast } from "@/components/ui/toast";
import {
  useGetAppSettingsQuery,
  useSetEnableWorktreesMutation,
} from "@/lib/redux/api";

export default function GitSettings() {
  const { data: settings, isLoading } = useGetAppSettingsQuery();
  const [setEnableWorktrees, { isLoading: updating }] =
    useSetEnableWorktreesMutation();

  const enableWorktrees = settings?.enableWorktrees ?? true;

  const handleWorktreeToggle = async (enabled: boolean) => {
    if (updating) return;
    try {
      await setEnableWorktrees(enabled).unwrap();
      toast.success(
        enabled
          ? "Worktrees enabled — new projects will use isolated copies"
          : "Worktrees disabled — new projects will use the repo directly",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update worktree setting");
    }
  };

  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2">Git</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Git</Heading2>
      </div>

      <SettingsRow
        title="Worktrees"
        description="Work in an isolated copy of your repo, so you can work on multiple tasks at the same time. When disabled, Jinzo uses the active branch directly."
      >
        <Toggle enabled={enableWorktrees} onChange={handleWorktreeToggle} />
      </SettingsRow>

      <SettingsDivider />
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-7">
      <div className="flex-1 pr-8">
        <h3 className="text-sm font-medium text-primary-900 dark:text-primary-100">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-primary-500 dark:text-primary-500 mt-1.5">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsDivider() {
  return (
    <div className="border-b border-primary-200 dark:border-primary-800/50" />
  );
}
