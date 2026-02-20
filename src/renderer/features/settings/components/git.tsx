import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { toast } from "@/components/ui/toast";
import { SettingsRow, SettingsDivider } from "./settings-layout";
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


