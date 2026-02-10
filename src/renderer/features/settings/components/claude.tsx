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
  const [updateProvider, { isLoading: updating }] =
    useUpdateProviderMutation();

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
    ? structuredOutputs[structuredOutputsSelectedId]?.name ?? "Off"
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

      {/* Structured Output */}
      <SettingsRow
        title="Structured output"
        description="Define JSON Schemas to constrain the agent's output format. The selected schema is sent to the Claude SDK as outputFormat."
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

      {/* Skills */}
      <SettingsRow
        title="Skills"
        description="SKILL.md files that extend Claude's capabilities. Located in ~/.claude/skills/ (user) and .claude/skills/ (project)."
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
        description="Define agents as markdown files in ~/.claude/agents/."
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

      {/* Slash Commands */}
      <SettingsRow
        title="Slash Commands"
        description="Custom slash commands available during agent sessions. Discovered from the Claude CLI."
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
