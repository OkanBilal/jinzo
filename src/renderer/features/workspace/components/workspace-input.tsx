import { useReducer, useRef, useEffect, useCallback } from "react";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import type { Run } from "../types";
import type { FileNode } from "@/features/workspace/components/file-explorer";
import type { ContextIssue } from "@/lib/redux/slices/workspaceSlice";
import type { UploadedFile } from "@/components/ui/input/file-upload-dropdown";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { InputForm } from "@/components/ui/input/input-form";
import { SlashMenuDropdown } from "@/features/workspace/components/slash-menu-dropdown";
import { ContextChips } from "./context-chips";
import { InputToolbar } from "./input-toolbar";
import { useProviderModels } from "../hooks/use-provider-models";

const EMPTY_CONTEXT_FILES: FileNode[] = [];
const EMPTY_CONTEXT_ISSUES: ContextIssue[] = [];
const EMPTY_UPLOADED_FILES: UploadedFile[] = [];

interface WorkspaceInputProps {
  goal: string;
  onGoalChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  activeRun: Run | undefined;
  canResume?: boolean;
  providerId?: string;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  contextFiles?: FileNode[];
  onRemoveContextFile?: (filePath: string) => void;
  contextIssues?: ContextIssue[];
  onRemoveContextIssue?: (entityId: string) => void;
  workspacePath?: string;
  uploadedFiles?: UploadedFile[];
  onUploadedFilesChange?: (files: UploadedFile[]) => void;
  onStop?: () => void;
}

export function WorkspaceInput({
  goal,
  onGoalChange,
  onSubmit,
  isLoading,
  activeRun,
  canResume = false,
  providerId,
  selectedModel: externalSelectedModel,
  onModelChange: externalOnModelChange,
  contextFiles = EMPTY_CONTEXT_FILES,
  onRemoveContextFile,
  contextIssues = EMPTY_CONTEXT_ISSUES,
  onRemoveContextIssue,
  workspacePath,
  uploadedFiles = EMPTY_UPLOADED_FILES,
  onUploadedFilesChange,
  onStop,
}: WorkspaceInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slashCommandDropdownRef = useRef<HTMLDivElement>(null);

  const variant = useWorkspaceVariant();
  const providerVariant: "claude" | "copilot" =
    variant === "claude" ? "claude" : "copilot";
  const defaultProviderId =
    providerVariant === "claude" ? "claude_code" : "copilot_cli";
  const activeProviderId = providerId ?? defaultProviderId;

  const {
    selectedModelDisplayName,
    modelDisplayNames,
    isLoadingModels,
    handleModelChange,
    providerCommands,
    isLoadingCommands,
    providerSkills,
    isLoadingSkills,
    planMode,
    handlePlanModeToggle,
    thinkingMode,
    handleThinkingModeToggle,
  } = useProviderModels(
    activeProviderId,
    providerVariant,
    externalSelectedModel,
    externalOnModelChange,
    workspacePath,
  );

  // Cmd+P to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [slashMenu, updateSlashMenu] = useReducer(
    (prev: { visible: boolean; filter: string }, next: Partial<{ visible: boolean; filter: string }>) => ({ ...prev, ...next }),
    { visible: false, filter: "" },
  );

  // Detect slash commands when goal is set externally (e.g. quick actions)
  useEffect(() => {
    const slashMatch = goal.match(/(?:^|\s)\/(\S*)$/);
    if (slashMatch) {
      updateSlashMenu({ filter: slashMatch[1], visible: true });
      inputRef.current?.focus();
    }
  }, [goal]);

  const handleGoalChange = useCallback(
    (value: string) => {
      onGoalChange(value);
      const slashMatch = value.match(/(?:^|\s)\/(\S*)$/);
      if (slashMatch) {
        updateSlashMenu({ filter: slashMatch[1], visible: true });
      } else {
        updateSlashMenu({ visible: false, filter: "" });
      }
    },
    [onGoalChange],
  );

  const handleSlashCommandSelect = useCallback(
    (command: CommandInfo) => {
      const newGoal = goal.replace(/(?:^|\s)\/\S*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}/${command.name} `;
      });
      onGoalChange(newGoal);
      updateSlashMenu({ visible: false, filter: "" });
    },
    [goal, onGoalChange],
  );

  const handleSkillSelect = useCallback(
    (skill: SkillInfo) => {
      const newGoal = goal.replace(/(?:^|\s)\/\S*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}/${skill.name} `;
      });
      onGoalChange(newGoal);
      updateSlashMenu({ visible: false, filter: "" });
    },
    [goal, onGoalChange],
  );

  const glassMorphismClass =
    variant === "claude" ? "glass-morphism-claude" : "glass-morphism-copilot";

  return (
    <div
      className={`w-200 mb-4 mx-auto flex flex-col pb-2 rounded-3xl ${glassMorphismClass}
        cursor-pointer transition-all`}
    >
      <ContextChips
        contextFiles={contextFiles}
        contextIssues={contextIssues}
        onRemoveContextFile={onRemoveContextFile}
        onRemoveContextIssue={onRemoveContextIssue}
      />
      <div className="relative">
        <InputForm
          ref={inputRef}
          query={goal}
          onQueryChange={handleGoalChange}
          onSubmit={onSubmit}
          placeholder={
            canResume
              ? "Ask a follow-up question, run /commands"
              : "Ask to edit, run /skills, or add issues/files to context"
          }
          variant={variant}
        />
        <SlashMenuDropdown
          commands={providerCommands}
          skills={providerSkills}
          isOpen={slashMenu.visible}
          onSelectCommand={handleSlashCommandSelect}
          onSelectSkill={handleSkillSelect}
          onClose={() => updateSlashMenu({ visible: false })}
          dropdownRef={slashCommandDropdownRef}
          filterText={slashMenu.filter}
          variant={variant}
          isLoadingCommands={isLoadingCommands}
          isLoadingSkills={isLoadingSkills}
        />
      </div>
      <InputToolbar
        variant={providerVariant}
        isLoading={isLoading}
        onSubmit={onSubmit}
        onGoalChange={onGoalChange}
        selectedModelDisplayName={selectedModelDisplayName}
        modelDisplayNames={modelDisplayNames}
        onModelChange={handleModelChange}
        isLoadingModels={isLoadingModels}
        planMode={planMode}
        onPlanModeToggle={handlePlanModeToggle}
        thinkingMode={thinkingMode}
        onThinkingModeToggle={handleThinkingModeToggle}
        isRunning={activeRun?.status === "running"}
        onStop={onStop}
        uploadedFiles={uploadedFiles}
        onUploadedFilesChange={onUploadedFilesChange ?? (() => {})}
      />
    </div>
  );
}
