import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { Button } from "../../../components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";

export default function ClaudeSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("claude_code");
  const [updateProvider, { isLoading: updating }] =
    useUpdateProviderMutation();

  const config = provider?.config ?? {};
  const permissionMode = (config as any).permissionMode ?? "bypassPermissions";
  const isBypassing = permissionMode === "bypassPermissions";

  const handlePermissionToggle = async (enabled: boolean) => {
    if (!provider || updating) return;

    const newMode = enabled ? "bypassPermissions" : "default";

    try {
      await updateProvider({
        id: "claude_code",
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

  const openPath = (targetPath: string) => {
    window.api.shell.openPath(targetPath);
  };

  const homedir = window.api.platform.homedir;

  if (isLoading) {
    return (
      <div>
        <Heading2 className="mb-2">Claude Agent</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div>
        <Heading2 className="mb-2">Claude Agent</Heading2>
        <Muted>
          Claude Code provider not found. Make sure it is configured in the
          database.
        </Muted>
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Claude Agent</Heading2>
      </div>

      {/* Permissions */}
      <SettingsRow
        title="Bypass Permissions"
        description="When enabled, the Claude agent can use all tools without asking for approval. When disabled, each tool call requires your confirmation."
      >
        <Toggle
          enabled={isBypassing}
          onChange={handlePermissionToggle}
        />
      </SettingsRow>

      <SettingsDivider />

      {/* Skills */}
      <SettingsRow
        title="Skills"
        description="SKILL.md files that extend Claude's capabilities. Located in ~/.claude/skills/ (user) and .claude/skills/ (project)."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openPath(`${homedir}/.claude/skills`)}
        >
          Open Folder
        </Button>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow
        title="Agents"
        description="Define agents as markdown files in ~/.claude/agents/."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openPath(`${homedir}/.claude/settings.json`)}
        >
          Open Settings File
        </Button>
      </SettingsRow>

      <SettingsDivider />

      {/* Slash Commands */}
      <SettingsRow
        title="Slash Commands"
        description="Custom slash commands available during agent sessions. Discovered from the Claude CLI."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openPath(`${homedir}/.claude/commands`)}
        >
          Open Folder
        </Button>
      </SettingsRow>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
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
