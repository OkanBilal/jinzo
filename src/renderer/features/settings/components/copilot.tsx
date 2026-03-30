import { Heading2, Muted, Toggle, Button, toast } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  useGetSpacesQuery,
  useArchiveSpaceMutation,
  useUnarchiveSpaceMutation,
  useSetActiveSpaceMutation,
} from "@/lib/redux/api";

export default function CopilotSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("copilot_cli");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();

  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const copilotSpace = spaces.find((s) => s.slug === "copilot");
  const otherVisibleSpaces = spaces.filter((s) => s.slug !== "copilot" && !s.isArchived);
  const canHide = otherVisibleSpaces.length > 0;

  const config = provider?.config ?? {};
  const permissionMode = (config as any).permissionMode ?? "default";
  const isBypassing = permissionMode === "bypassPermissions";

  const openPath = (targetPath: string) => {
    window.api.shell.openPath(targetPath);
  };

  const homedir = window.api.platform.homedir;

  const handlePermissionToggle = async (enabled: boolean) => {
    if (!provider || updating) return;

    const newMode = enabled ? "bypassPermissions" : "default";

    try {
      await updateProvider({
        id: "copilot_cli",
        payload: {
          config: {
            ...config,
            permissionMode: newMode,
          },
        },
      }).unwrap();
      toast.success(
        enabled
          ? "Permission bypass enabled"
          : "Permission bypass disabled — tools will require approval",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update permission mode");
    }
  };


  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2">Copilot</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div>
        <Heading2 className="mb-2">Copilot</Heading2>
        <Muted>
          Copilot provider not found. Make sure it is configured in the
          database.
        </Muted>
      </div>
    );
  }

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Copilot</Heading2>
      </div>

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

      {copilotSpace && (
        <SettingsSection title="Visibility">
          <SettingsRow
            title="Show in Selector"
            description={
              !canHide && !copilotSpace.isArchived
                ? "At least one agent must be active"
                : "Show or hide this agent from the selector"
            }
          >
            <Toggle
              enabled={!copilotSpace.isArchived}
              disabled={!canHide && !copilotSpace.isArchived}
              onChange={async (visible) => {
                try {
                  if (visible) {
                    await unarchiveSpace(copilotSpace.id).unwrap();
                    toast.success("Space is now visible");
                  } else {
                    await archiveSpace(copilotSpace.id).unwrap();
                    const target = otherVisibleSpaces[0];
                    if (target) {
                      await setActiveSpace(target.id).unwrap();
                    }
                    toast.success("Space hidden");
                  }
                } catch (err: any) {
                  toast.error(err?.message || "Failed to update space visibility");
                }
              }}
            />
          </SettingsRow>
        </SettingsSection>
      )}
    </div>
  );
}
