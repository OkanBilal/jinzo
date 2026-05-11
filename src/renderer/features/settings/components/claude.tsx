import { useState } from "react";
import { Button, Select } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { ClaudeCodeAdapterConfig } from "../../../../shared/adapter.types";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";

type ClaudePermissionMode = NonNullable<
  ClaudeCodeAdapterConfig["permissionMode"]
>;

const SETTINGS_PERMISSION_MODES: Array<{
  value: ClaudePermissionMode;
  label: string;
  description: string;
}> = [
  { value: "default", label: "Ask permissions", description: "Always ask before making changes" },
  { value: "auto", label: "Auto", description: "Claude Code picks when to prompt vs allow, based on risk" },
  { value: "acceptEdits", label: "Auto accept edits", description: "Automatically accept all file edits" },
  { value: "plan", label: "Plan mode", description: "Create a plan before making changes" },
  { value: "bypassPermissions", label: "Bypass permissions", description: "Accepts all permissions" },
  { value: "dontAsk", label: "Don't ask", description: "Deny unapproved tools silently" },
];

export default function ClaudeSettings(
) {
  const {
    provider,
    isLoading,
    error,
    updating,
    config,
    updateConfig,
  } = useProviderSettings<ClaudeCodeAdapterConfig>(PROVIDER_IDS.claude, "claude");

  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] =
    useState(false);

  const permissionMode = config.permissionMode ?? "bypassPermissions";

  const structuredOutputs = config.structuredOutputs ?? {};
  const structuredOutputsSelectedId = config.structuredOutputsSelectedId ?? null;
  const selectedSchemaName = structuredOutputsSelectedId
    ? (structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off")
    : "Off";

  const handlePermissionModeChange = async (mode: ClaudePermissionMode) => {
    if (!provider || updating) return;
    await updateConfig({ permissionMode: mode });
  };

  const openPath = (targetPath: string) => {
    window.api.shell.openPath(targetPath);
  };

  const homedir = window.api.platform.homedir;

  return (
    <ProviderSettingsLayout
      title="Claude"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      <SettingsSection  title="Configuration">
        <SettingsRow
          title="Permission Mode"
          description="Controls how the agent handles tool permissions during runs."
        >
          <Select
          useFixedBackground={true}
            value={permissionMode}
            options={SETTINGS_PERMISSION_MODES}
            onChange={handlePermissionModeChange}
          />
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


      <SettingsSection title="Capabilities">
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

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
        providerId={PROVIDER_IDS.claude}
      />
    </ProviderSettingsLayout>
  );
}


