import { useState } from "react";
import { AsciiSpinner, Button, Select } from "@/components/ui";
import { SettingsSection, SettingsRow, SettingsDivider } from "./settings-layout";
import { useCapabilities } from "@/lib/platform";
import {
  ProviderSettingsLayout,
  useProviderSettings,
} from "./provider-settings-shared";
import { StructuredOutputsModal } from "./structured-outputs-modal";
import type { ClaudeCodeAdapterConfig } from "../../../../shared/adapter.types";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";
import {
  useGetProviderAccountInfoQuery,
  useUpdateProviderCliMutation,
} from "@/lib/redux/api";

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

  const { data: accountInfo, isLoading: isLoadingAccount } =
    useGetProviderAccountInfoQuery(PROVIDER_IDS.claude);
  const account = accountInfo?.account;
  const cli = accountInfo?.cli;
  const [updateCli, { isLoading: isUpdatingCli }] = useUpdateProviderCliMutation();
  const [cliUpdateResult, setCliUpdateResult] = useState<string | null>(null);

  const handleUpdateCli = async () => {
    setCliUpdateResult(null);
    try {
      const res = await updateCli(PROVIDER_IDS.claude).unwrap();
      setCliUpdateResult(res.success ? "Claude CLI updated." : res.output || "Update failed.");
    } catch {
      setCliUpdateResult("Update failed.");
    }
  };

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
  const { revealInFolder } = useCapabilities();

  return (
    <ProviderSettingsLayout
      title="Claude"
      provider={provider}
      isLoading={isLoading}
      error={error}
    >
      {/* Account info — from the Claude Code login session */}
      <SettingsSection title="Account">
        {isLoadingAccount ? (
          <div className="flex items-center justify-between py-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
              <div className="h-3 w-24 rounded bg-primary-200/30 dark:bg-primary-700/20 animate-pulse" />
            </div>
            <div className="h-4 w-12 rounded bg-primary-200/50 dark:bg-primary-700/30 animate-pulse" />
          </div>
        ) : account?.type === "claude" ? (
          <SettingsRow title={account.email} description="Signed in">
            <span className="text-sm font-medium text-primary-900 dark:text-primary-100">
              {account.planType || "Claude"}
            </span>
          </SettingsRow>
        ) : account?.type === "apiKey" ? (
          <SettingsRow title="Authentication" description="Connected via API key">
            <span className="text-sm text-primary-500 dark:text-primary-400">API Key</span>
          </SettingsRow>
        ) : (
          <SettingsRow
            title="Not signed in"
            description="Run `claude login` in your terminal to authenticate"
          >
            <span className="text-xs text-primary-400 dark:text-primary-500">No account</span>
          </SettingsRow>
        )}
      </SettingsSection>

      {/* CLI version + self-update — `claude --version` / `claude update` */}
      <SettingsSection title="CLI">
        <SettingsRow
          title="Claude Code CLI"
          description={cli?.version ? `Version ${cli.version}` : "Version unknown"}
        >
          <div className="flex items-center gap-3">
            {cliUpdateResult && (
              <span className="text-xs text-primary-500 dark:text-primary-400">
                {cliUpdateResult}
              </span>
            )}
            <Button
              variant="primary"
              onClick={handleUpdateCli}
              disabled={isUpdatingCli}
              className="gap-1 flex items-center"
            >
              {isUpdatingCli ? (
                <AsciiSpinner variant="null" kind="download" />
              ) : null}
              {isUpdatingCli ? "Updating…" : "Update CLI"}
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection  title="Configuration">
        <SettingsRow
          title="Permission Mode"
          description="Controls how the agent handles tool permissions during runs."
        >
          <Select
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
              onClick={() => setIsStructuredOutputsModalOpen(true)}
            >
              Edit
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>


      {revealInFolder && (
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
            onClick={() => openPath(`${homedir}/.claude/commands`)}
          >
            Open Folder
          </Button>
        </SettingsRow>
        </SettingsSection>
      )}

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
        providerId={PROVIDER_IDS.claude}
      />
    </ProviderSettingsLayout>
  );
}


