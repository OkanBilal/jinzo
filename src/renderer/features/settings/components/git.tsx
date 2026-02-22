import { useState } from "react";
import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  useGetAppSettingsQuery,
  useSetEnableWorktreesMutation,
  useSetCommitInstructionsMutation,
  useSetPrInstructionsMutation,
} from "@/lib/redux/api";

export default function GitSettings() {
  const { data: settings, isLoading } = useGetAppSettingsQuery();
  const [setEnableWorktrees, { isLoading: updating }] =
    useSetEnableWorktreesMutation();
  const [setCommitInstructions] = useSetCommitInstructionsMutation();
  const [setPrInstructions] = useSetPrInstructionsMutation();
  const [localInstructions, setLocalInstructions] = useState<string | null>(null);
  const [localPrInstructions, setLocalPrInstructions] = useState<string | null>(null);

  const enableWorktrees = settings?.enableWorktrees ?? true;
  const commitInstructions = localInstructions ?? settings?.commitInstructions ?? "";
  const prInstructions = localPrInstructions ?? settings?.prInstructions ?? "";

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

  const handleCommitInstructionsBlur = async () => {
    if (localInstructions === null) return;
    try {
      await setCommitInstructions(localInstructions).unwrap();
      setLocalInstructions(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update commit instructions");
    }
  };

  const handlePrInstructionsBlur = async () => {
    if (localPrInstructions === null) return;
    try {
      await setPrInstructions(localPrInstructions).unwrap();
      setLocalPrInstructions(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update PR instructions");
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
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Git</Heading2>
      </div>

      <SettingsSection>
        <SettingsRow
          title="Worktrees"
          description="Work in an isolated copy of your repo, so you can work on multiple tasks at the same time. When disabled, Jinzo uses the active branch directly."
        >
          <Toggle enabled={enableWorktrees} onChange={handleWorktreeToggle} />
        </SettingsRow>

        <SettingsDivider />

        <SettingsRow
          variant="detail"
          title="Commit Instructions"
          description="Added to commit message generation prompts"
        >
          <Textarea
            value={commitInstructions}
            onChange={(e) => setLocalInstructions(e.target.value)}
            onBlur={handleCommitInstructionsBlur}
            placeholder="e.g., use conventional commits, keep under 72 chars"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>

        <SettingsDivider />

        <SettingsRow
          variant="detail"
          title="PR Instructions"
          description="Added to pull request creation prompts"
        >
          <Textarea
            value={prInstructions}
            onChange={(e) => setLocalPrInstructions(e.target.value)}
            onBlur={handlePrInstructionsBlur}
            placeholder="e.g., include test plan, link related issues"
            rows={2}
            className="min-w-0"
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}


