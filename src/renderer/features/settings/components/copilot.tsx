import { Toggle, Button, toast } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  ProviderSettingsLayout,
  ProviderVisibilitySection,
  useProviderSettings,
} from "./provider-settings-shared";

export default function CopilotSettings() {
  const {
    provider,
    isLoading,
    error,
    updating,
    config,
    space,
    canHide,
    updateConfig,
    setSpaceVisible,
  } = useProviderSettings("copilot_cli", "copilot");
  const permissionMode = (config as any).permissionMode ?? "default";
  const isBypassing = permissionMode === "bypassPermissions";

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

      <ProviderVisibilitySection
        space={space}
        canHide={canHide}
        onVisibleChange={setSpaceVisible}
      />
    </ProviderSettingsLayout>
  );
}
