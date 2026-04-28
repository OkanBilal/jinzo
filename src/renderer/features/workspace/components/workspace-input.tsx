import { useReducer, useRef, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import type { Run } from "../types";
import type { FileNode } from "@/features/workspace/types/file-explorer";
import type { ContextIssue, ContextSignal, ContextSkill, ContextBrowserSelection } from "@/lib/redux/slices/workspaceSlice";
import { addContextFile, addContextIssue, addContextSkill } from "@/lib/redux/slices/workspaceSlice";
import type { UploadedFile } from "@/components/ui";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { InputForm } from "@/components/ui";
import { SlashMenuDropdown } from "@/features/workspace/components/slash-menu-dropdown";
import { FileMentionDropdown } from "@/features/workspace/components/file-mention-dropdown";
import { IssueMentionDropdown } from "@/features/workspace/components/issue-mention-dropdown";
import { SkillMentionDropdown } from "@/features/workspace/components/skill-mention-dropdown";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import { ContextChips } from "./context-chips";
import { InputToolbar } from "./input-toolbar";
import { useProviderModels } from "../hooks/use-provider-models";

const EMPTY_CONTEXT_FILES: FileNode[] = [];
const EMPTY_CONTEXT_ISSUES: ContextIssue[] = [];
const EMPTY_CONTEXT_SIGNALS: ContextSignal[] = [];
const EMPTY_CONTEXT_SKILLS: ContextSkill[] = [];
const EMPTY_CONTEXT_BROWSER: ContextBrowserSelection[] = [];
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
  contextSignals?: ContextSignal[];
  onRemoveContextSignal?: (entityId: string) => void;
  contextSkills?: ContextSkill[];
  onRemoveContextSkill?: (name: string) => void;
  contextBrowserSelections?: ContextBrowserSelection[];
  onRemoveContextBrowserSelection?: (id: string) => void;
  workspacePath?: string;
  projectId?: string;
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
  contextSignals = EMPTY_CONTEXT_SIGNALS,
  onRemoveContextSignal,
  contextSkills = EMPTY_CONTEXT_SKILLS,
  onRemoveContextSkill,
  contextBrowserSelections = EMPTY_CONTEXT_BROWSER,
  onRemoveContextBrowserSelection,
  workspacePath,
  projectId,
  uploadedFiles = EMPTY_UPLOADED_FILES,
  onUploadedFilesChange,
  onStop,
}: WorkspaceInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slashCommandDropdownRef = useRef<HTMLDivElement>(null);
  const fileMentionDropdownRef = useRef<HTMLDivElement>(null);
  const issueMentionDropdownRef = useRef<HTMLDivElement>(null);
  const skillMentionDropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  const variant = useWorkspaceVariant();
  const providerVariant: "claude" | "copilot" | "codex" | "cursor" =
    variant === "claude" ? "claude" : variant === "codex" ? "codex" : variant === "cursor" ? "cursor" : "copilot";
  const defaultProviderId =
    providerVariant === "claude" ? "claude_code" : providerVariant === "codex" ? "codex" : providerVariant === "cursor" ? "cursor" : "copilot_cli";
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
    modelsError,
    refetchModels,
    permissionMode,
    handlePermissionModeChange,
    thinkingMode,
    handleThinkingModeToggle,
    fastMode,
    handleFastModeToggle,
    effortLevel,
    handleEffortLevelChange,
    selectedModelInfo,
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

  const [atMenu, updateAtMenu] = useReducer(
    (prev: { visible: boolean; filter: string }, next: Partial<{ visible: boolean; filter: string }>) => ({ ...prev, ...next }),
    { visible: false, filter: "" },
  );

  const [hashMenu, updateHashMenu] = useReducer(
    (prev: { visible: boolean; filter: string }, next: Partial<{ visible: boolean; filter: string }>) => ({ ...prev, ...next }),
    { visible: false, filter: "" },
  );

  const [dollarMenu, updateDollarMenu] = useReducer(
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

      const atMatch = value.match(/(?:^|\s)@(\S*)$/);
      if (atMatch) {
        updateAtMenu({ filter: atMatch[1], visible: true });
      } else {
        updateAtMenu({ visible: false, filter: "" });
      }

      const hashMatch = value.match(/(?:^|\s)#(\S*)$/);
      if (hashMatch) {
        updateHashMenu({ filter: hashMatch[1], visible: true });
      } else {
        updateHashMenu({ visible: false, filter: "" });
      }

      const dollarMatch = value.match(/(?:^|\s)\$(\S*)$/);
      if (dollarMatch) {
        updateDollarMenu({ filter: dollarMatch[1], visible: true });
      } else {
        updateDollarMenu({ visible: false, filter: "" });
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
      const newGoal = goal.replace(/(?:^|\s)\$\S*$/, (match) =>
        match.startsWith(" ") ? " " : "",
      );
      onGoalChange(newGoal.trimEnd());
      updateDollarMenu({ visible: false, filter: "" });
      if (!skill.path) return;
      dispatch(
        addContextSkill({
          name: skill.name,
          path: skill.path,
          description: skill.description,
        }),
      );
    },
    [goal, onGoalChange, dispatch],
  );

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      const newGoal = goal.replace(/(?:^|\s)@\S*$/, (match) =>
        match.startsWith(" ") ? " " : "",
      );
      onGoalChange(newGoal.trimEnd());
      updateAtMenu({ visible: false, filter: "" });
      dispatch(addContextFile(node));
    },
    [goal, onGoalChange, dispatch],
  );

  const handleIssueSelect = useCallback(
    (item: IssueWithEntity) => {
      const newGoal = goal.replace(/(?:^|\s)#\S*$/, (match) =>
        match.startsWith(" ") ? " " : "",
      );
      onGoalChange(newGoal.trimEnd());
      updateHashMenu({ visible: false, filter: "" });
      dispatch(addContextIssue({
        entityId: item.issue.entityId,
        title: item.entity.title,
        body: item.entity.body,
        provider: item.issue.provider,
        number: item.issue.number,
        labels: item.issue.labels,
      }));
    },
    [goal, onGoalChange, dispatch],
  );

  const handleAtMenuNavigate = useCallback(
    (dirPath: string) => {
      const newGoal = goal.replace(/(?:^|\s)@\S*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}@${dirPath}`;
      });
      onGoalChange(newGoal);
      updateAtMenu({ filter: dirPath });
    },
    [goal, onGoalChange],
  );

  const handleSubmit = useCallback(() => {
    if (atMenu.visible || slashMenu.visible || hashMenu.visible || dollarMenu.visible) return;
    onSubmit();
  }, [atMenu.visible, slashMenu.visible, hashMenu.visible, dollarMenu.visible, onSubmit]);

  //Copilot related TODO:
  const authErrorMessage = (() => {
    if (!modelsError) return null;
    const msg =
      typeof modelsError === "string"
        ? modelsError
        : typeof modelsError === "object" && "error" in modelsError
          ? String((modelsError as any).error)
          : null;
    if (msg && /not authenticated|gh auth login|cursor login/i.test(msg)) return msg;
    return null;
  })();


  return (
    <>
          {authErrorMessage && (
        <div className="w-200 mx-auto mb-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/10 text-yellow-200/80 text-xs flex items-center justify-between">
          <span>
            <span className="font-medium">Auth required:</span>{" "}
            {authErrorMessage}
          </span>
          <button
            type="button"
            onClick={() => refetchModels()}
            className="ml-3 shrink-0 px-2 py-0.5 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 transition-colors cursor-pointer"
          >
            Check Auth
          </button>
        </div>
      )}

    <div
      className={`w-200 mb-4 mx-auto flex flex-col pb-2 rounded-3xl glass-morphism
        cursor-pointer transition-all`}
    >
      <ContextChips
        contextFiles={contextFiles}
        contextIssues={contextIssues}
        contextSignals={contextSignals}
        contextSkills={contextSkills}
        contextBrowserSelections={contextBrowserSelections}
        onRemoveContextFile={onRemoveContextFile}
        onRemoveContextIssue={onRemoveContextIssue}
        onRemoveContextSignal={onRemoveContextSignal}
        onRemoveContextSkill={onRemoveContextSkill}
        onRemoveContextBrowserSelection={onRemoveContextBrowserSelection}
      />
      <div className="relative">
        <InputForm
          ref={inputRef}
          query={goal}
          onQueryChange={handleGoalChange}
          onSubmit={handleSubmit}
          placeholder={
            canResume
              ? "Ask a follow-up question, run /commands, $skills, @files or #issues to add context"
              : "Ask to edit, run /commands, $skills, @files or #issues to add context"
          }
        />
        <SlashMenuDropdown
          commands={providerCommands}
          isOpen={slashMenu.visible}
          onSelectCommand={handleSlashCommandSelect}
          onClose={() => updateSlashMenu({ visible: false })}
          dropdownRef={slashCommandDropdownRef}
          filterText={slashMenu.filter}
          isLoadingCommands={isLoadingCommands}
        />
        <SkillMentionDropdown
          isOpen={dollarMenu.visible}
          filterText={dollarMenu.filter}
          skills={providerSkills}
          isLoading={isLoadingSkills}
          onSelectSkill={handleSkillSelect}
          onClose={() => updateDollarMenu({ visible: false, filter: "" })}
          dropdownRef={skillMentionDropdownRef}
        />
        <FileMentionDropdown
          isOpen={atMenu.visible}
          filterText={atMenu.filter}
          workspacePath={workspacePath}
          onSelectFile={handleFileSelect}
          onNavigate={handleAtMenuNavigate}
          onClose={() => updateAtMenu({ visible: false, filter: "" })}
          dropdownRef={fileMentionDropdownRef}
        />
        <IssueMentionDropdown
          isOpen={hashMenu.visible}
          filterText={hashMenu.filter}
          projectId={projectId}
          onSelectIssue={handleIssueSelect}
          onClose={() => updateHashMenu({ visible: false, filter: "" })}
          dropdownRef={issueMentionDropdownRef}
        />
      </div>
      <InputToolbar
        variant={providerVariant}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onGoalChange={onGoalChange}
        selectedModelDisplayName={selectedModelDisplayName}
        modelDisplayNames={modelDisplayNames}
        onModelChange={handleModelChange}
        isLoadingModels={isLoadingModels}
        permissionMode={permissionMode}
        onPermissionModeChange={handlePermissionModeChange}
        thinkingMode={thinkingMode}
        onThinkingModeToggle={handleThinkingModeToggle}
        fastMode={fastMode}
        onFastModeToggle={handleFastModeToggle}
        supportsFastMode={selectedModelInfo?.supportsFastMode ?? false}
        effortLevel={effortLevel}
        onEffortLevelChange={handleEffortLevelChange}
        supportedEffortLevels={selectedModelInfo?.supportedEffortLevels}
        isRunning={activeRun?.status === "running"}
        onStop={onStop}
        uploadedFiles={uploadedFiles}
        onUploadedFilesChange={onUploadedFilesChange ?? (() => {})}
        disabled={!!authErrorMessage || (!isLoadingModels && modelDisplayNames.length === 0)}
      />
    </div>
     </>
  );
}
