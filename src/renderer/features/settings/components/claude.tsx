import { useState } from "react";
import { Heading2, Muted } from "../../../components/ui/text";
import { Toggle } from "../../../components/ui/toggle";
import { Button } from "../../../components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
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

  const [isStructuredOutputsModalOpen, setIsStructuredOutputsModalOpen] =
    useState(false);

  const config = provider?.config ?? {};
  const permissionMode = (config as any).permissionMode ?? "bypassPermissions";
  const isBypassing = permissionMode === "bypassPermissions";

  const structuredOutputs = ((config as any).structuredOutputs ?? {}) as Record<
    string,
    StructuredOutputEntry
  >;
  const structuredOutputsSelectedId =
    ((config as any).structuredOutputsSelectedId as string | null) ?? null;
  const selectedSchemaName = structuredOutputsSelectedId
    ? (structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off")
    : "Off";

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

      <SettingsRow
        title="Bypass Permissions"
        description={
          <>
            When enabled, the Claude agent can use all tools without asking for
            approval. When disabled, each tool call requires your confirmation.{" "}
            <br />
            <span className="text-amber-700 dark:text-amber-600 font-medium ">
              ⚠ Enabling this gives the agent full control over file operations
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
            Define JSON Schemas to constrain the agent's output format. The
            selected schema is sent to the Claude SDK as outputFormat.{" "}
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

      <SettingsDivider />

      <SettingsRow
        title="Skills"
        description={
          <>
            SKILL.md files that extend Claude's capabilities. Located in
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

      <StructuredOutputsModal
        isOpen={isStructuredOutputsModalOpen}
        onClose={() => setIsStructuredOutputsModalOpen(false)}
      />
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
