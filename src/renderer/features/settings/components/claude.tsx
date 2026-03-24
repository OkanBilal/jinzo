import { useState } from "react";
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
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { StructuredOutputEntry } from "../../../../main/modules/providers/adapters/adapter.types";

export default function ClaudeSettings() {
  const {
    data: provider,
    isLoading,
    error,
  } = useGetProviderByIdQuery("claude_code");
  const [updateProvider, { isLoading: updating }] = useUpdateProviderMutation();

  const { data: spaces = [] } = useGetSpacesQuery();
  const [archiveSpace] = useArchiveSpaceMutation();
  const [unarchiveSpace] = useUnarchiveSpaceMutation();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const claudeSpace = spaces.find((s) => s.slug === "claude");
  const otherVisibleSpaces = spaces.filter((s) => s.slug !== "claude" && !s.isArchived);
  const canHide = otherVisibleSpaces.length > 0;

  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] =
    useState(false);

  const config = provider?.config ?? {};
  const permissionMode = (config as any).permissionMode ?? "bypassPermissions";
  const isBypassing = permissionMode === "bypassPermissions";
  const showQuickActions = (config as any).showQuickActions !== false;

  const structuredOutputs = ((config as any).structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const structuredOutputsSelectedId =
    ((config as any).structuredOutputsSelectedId as string | null) ?? null;
  const selectedSchemaName = structuredOutputsSelectedId
    ? (structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off")
    : "Off";

  const handleQuickActionsToggle = async (enabled: boolean) => {
    if (!provider || updating) return;

    try {
      await updateProvider({
        id: "claude_code",
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
        <Heading2 className="mb-2">Claude</Heading2>
        <Muted>Loading...</Muted>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div>
        <Heading2 className="mb-2">Claude</Heading2>
        <Muted>
          Claude provider not found. Make sure it is configured in the
          database.
        </Muted>
      </div>
    );
  }

  return (
    <div className="bg-primary dark:bg-primary-950">
      <div className="mb-8">
        <Heading2 className="font-medium!">Claude</Heading2>
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
        <SettingsDivider />
        <SettingsRow
          title="Structured Output"
          description={
            <>
              Define JSON Schemas to constrain the agent&apos;s output format.{" "}
              <a
                href="https://platform.claude.com/docs/en/agent-sdk/structured-outputs"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-200 dark:hover:text-primary-300 underline"
              >
                Learn more about structured outputs
              </a>
            </>
          }
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-500 dark:text-primary-400">
              {selectedSchemaName}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsStructuredOutputsModalOpen(true)}
            >
              Edit
            </Button>
          </div>
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

      <SettingsSection title="Extensions">
        <SettingsRow
          title="MCP Servers"
          description={
            <>
              Connect external tools via the Model Context Protocol. Servers
              configured here are passed to the SDK programmatically. The CLI also
              auto-loads .mcp.json from the project root.{" "}
              <a
                href="https://platform.claude.com/docs/en/agent-sdk/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-200 dark:hover:text-primary-300 underline"
              >
                Learn more about MCP
              </a>
            </>
          }
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPath(`${homedir}/.claude.json`)}
          >
            Open Config
          </Button>
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Skills"
          description={
            <>
              SKILL.md files that extend Claude&apos;s capabilities. Located in
              ~/.claude/skills/ (user) and .claude/skills/ (project).{" "}
              <a
                href="https://platform.claude.com/docs/en/agent-sdk/skills"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-200 dark:hover:text-primary-300 underline"
              >
                Learn more about skills
              </a>
            </>
          }
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPath(`${homedir}/.claude/skills`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Agents"
          description={
            <>
              Define agents as markdown files in ~/.claude/agents/.{" "}
              <a
                href="https://platform.claude.com/docs/en/agent-sdk/subagents"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-200 dark:hover:text-primary-300 underline"
              >
                Learn more about subagents
              </a>
            </>
          }
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPath(`${homedir}/.claude/agents`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
        <SettingsDivider />
        <SettingsRow
          title="Slash Commands"
          description={
            <>
              Custom slash commands available during agent sessions. Discovered
              from the Claude CLI.{" "}
              <a
                href="https://platform.claude.com/docs/en/agent-sdk/slash-commands"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary-500 hover:text-primary-600 dark:text-primary-200 dark:hover:text-primary-300 underline"
              >
                Learn more about slash commands
              </a>
            </>
          }
        >
          <Button
            variant="primary"
            size="sm"
            onClick={() => openPath(`${homedir}/.claude/commands`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
      </SettingsSection>

      {claudeSpace && (
        <SettingsSection title="Space">
          <SettingsRow
            title="Show in Sidebar"
            description={
              !canHide && !claudeSpace.isArchived
                ? "At least one space must be visible"
                : "Show or hide this space from the sidebar"
            }
          >
            <Toggle
              enabled={!claudeSpace.isArchived}
              disabled={!canHide && !claudeSpace.isArchived}
              onChange={async (visible) => {
                try {
                  if (visible) {
                    await unarchiveSpace(claudeSpace.id).unwrap();
                    toast.success("Space is now visible");
                  } else {
                    await archiveSpace(claudeSpace.id).unwrap();
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

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
        providerId="claude_code"
      />
    </div>
  );
}


