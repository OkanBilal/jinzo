import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { toast } from "@/components/ui/toast";
import { SettingsSection, SettingsRow } from "./settings-layout";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";

export default function CopilotSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("copilot_cli");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();

  const config = provider?.config ?? {};
  const permissionMode = (config as any).permissionMode ?? "default";
  const isBypassing = permissionMode === "bypassPermissions";
  const showQuickActions = (config as any).showQuickActions !== false;

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

  const handleQuickActionsToggle = async (enabled: boolean) => {
    if (!provider || updating) return;

    try {
      await updateProvider({
        id: "copilot_cli",
        payload: {
          config: {
            ...config,
            showQuickActions: enabled,
          },
        },
      }).unwrap();
      toast.success(
        enabled ? "Quick actions enabled" : "Quick actions hidden",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to update quick actions setting");
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

      <SettingsSection>
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

      <SettingsSection title="Workspace">
        <SettingsRow
          title="Quick Actions"
          description="Show quick action buttons in workspace"
        >
          <Toggle enabled={showQuickActions} onChange={handleQuickActionsToggle} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
