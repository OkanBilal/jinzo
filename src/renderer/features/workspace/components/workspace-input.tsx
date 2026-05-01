import { useReducer, useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useDispatch } from "react-redux";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import type { Run } from "../types";
import type { FileNode } from "@/features/workspace/types/file-explorer";
import type { ContextIssue, ContextSignal, ContextSkill, ContextBrowserSelection } from "@/lib/redux/slices/workspaceSlice";
import { addContextFile, addContextIssue, addContextSkill, removeContextSkill } from "@/lib/redux/slices/workspaceSlice";
import type { UploadedFile, RichInputFormHandle, RichSkillChipData } from "@/components/ui";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { RichInputForm } from "@/components/ui";
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

function looksLikeImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic|svg)$/i.test(file.name);
}

/** Matches toolbar document picker: pdf, doc, docx, txt */
function looksLikeDocumentFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain"
  ) {
    return true;
  }
  return /\.(pdf|doc|docx|txt)$/i.test(file.name);
}

function isAttachableUpload(file: File): boolean {
  return looksLikeImageFile(file) || looksLikeDocumentFile(file);
}

/**
 * When the dropdown steals focus, caret-based DOM replace fails. Rewrites `goal` by finding
 * the active mention token (same boundary rules as caret detection: start or whitespace before trigger).
 */
function replaceMentionInGoal(
  goal: string,
  trigger: string,
  filter: string,
  replacement: string,
): string | null {
  const suffix = trigger + filter;
  let idx = goal.lastIndexOf(suffix);
  while (idx >= 0) {
    const prev = idx === 0 ? "" : goal[idx - 1];
    if (idx === 0 || /\s/.test(prev)) {
      return goal.slice(0, idx) + replacement + goal.slice(idx + suffix.length);
    }
    idx = goal.lastIndexOf(suffix, idx - 1);
  }
  return null;
}

function fileToUploadedFile(file: File): UploadedFile {
  const isImage = looksLikeImageFile(file);
  return {
    file,
    type: isImage ? "image" : "document",
    preview: isImage ? URL.createObjectURL(file) : undefined,
  };
}

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
  contextBrowserSelections = EMPTY_CONTEXT_BROWSER,
  onRemoveContextBrowserSelection,
  workspacePath,
  projectId,
  uploadedFiles = EMPTY_UPLOADED_FILES,
  onUploadedFilesChange,
  onStop,
}: WorkspaceInputProps) {
  const inputRef = useRef<RichInputFormHandle>(null);
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
    },
    [onGoalChange],
  );

  // Triggers fire based on the text BEFORE the caret, so users can insert mentions
  // mid-text — not just at the end of the prompt.
  const handleCaretContext = useCallback((before: string) => {
    const slashMatch = before.match(/(?:^|\s)\/(\S*)$/);
    if (slashMatch) updateSlashMenu({ filter: slashMatch[1], visible: true });
    else updateSlashMenu({ visible: false, filter: "" });

    const atMatch = before.match(/(?:^|\s)@(\S*)$/);
    if (atMatch) updateAtMenu({ filter: atMatch[1], visible: true });
    else updateAtMenu({ visible: false, filter: "" });

    const hashMatch = before.match(/(?:^|\s)#(\S*)$/);
    if (hashMatch) updateHashMenu({ filter: hashMatch[1], visible: true });
    else updateHashMenu({ visible: false, filter: "" });

    const dollarMatch = before.match(/(?:^|\s)\$(\S*)$/);
    if (dollarMatch) updateDollarMenu({ filter: dollarMatch[1], visible: true });
    else updateDollarMenu({ visible: false, filter: "" });
  }, []);

  const handleSlashCommandSelect = useCallback(
    (command: CommandInfo) => {
      const replacement = `/${command.name} `;
      const ok = inputRef.current?.replaceTokenWithText("/", replacement) ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, "/", slashMenu.filter, replacement);
        if (next !== null) onGoalChange(next);
      }
      updateSlashMenu({ visible: false, filter: "" });
    },
    [goal, onGoalChange, slashMenu.filter],
  );

  const handleSkillSelect = useCallback(
    (skill: SkillInfo) => {
      updateDollarMenu({ visible: false, filter: "" });
      if (!skill.path) return;
      // Persist to Redux first so submission flow keeps working; chip is the inline view.
      dispatch(
        addContextSkill({
          name: skill.name,
          path: skill.path,
          description: skill.description,
          displayName: skill.displayName,
          shortDescription: skill.shortDescription,
          iconSmall: skill.iconSmall,
          iconLarge: skill.iconLarge,
          brandColor: skill.brandColor,
          scope: skill.scope,
        }),
      );
      inputRef.current?.replaceTokenWithSkillChip("$", {
        name: skill.name,
        displayName: skill.displayName,
        iconSmall: skill.iconSmall,
        iconLarge: skill.iconLarge,
        brandColor: skill.brandColor,
      });
    },
    [dispatch],
  );

  const contextSkillsRef = useRef(contextSkills);
  useEffect(() => {
    contextSkillsRef.current = contextSkills;
  }, [contextSkills]);

  const skillChipMap = useMemo(() => {
    const m = new Map<string, RichSkillChipData>();
    for (const s of contextSkills) {
      m.set(s.name, {
        name: s.name,
        displayName: s.displayName,
        iconSmall: s.iconSmall,
        iconLarge: s.iconLarge,
        brandColor: s.brandColor,
      });
    }
    return m;
  }, [contextSkills]);

  const handleSkillChipsChange = useCallback(
    (names: string[]) => {
      const present = new Set(names);
      for (const skill of contextSkillsRef.current) {
        if (!present.has(skill.name)) {
          dispatch(removeContextSkill(skill.name));
        }
      }
    },
    [dispatch],
  );

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      const ok = inputRef.current?.replaceTokenWithText("@", "") ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, "@", atMenu.filter, "");
        if (next !== null) onGoalChange(next);
      }
      updateAtMenu({ visible: false, filter: "" });
      dispatch(addContextFile(node));
    },
    [dispatch, goal, onGoalChange, atMenu.filter],
  );

  const handleIssueSelect = useCallback(
    (item: IssueWithEntity) => {
      const ok = inputRef.current?.replaceTokenWithText("#", "") ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, "#", hashMenu.filter, "");
        if (next !== null) onGoalChange(next);
      }
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
    [dispatch, goal, onGoalChange, hashMenu.filter],
  );

  const handleAtMenuNavigate = useCallback(
    (dirPath: string) => {
      const replacement = `@${dirPath}`;
      const ok = inputRef.current?.replaceTokenWithText("@", replacement) ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, "@", atMenu.filter, replacement);
        if (next !== null) onGoalChange(next);
      }
      updateAtMenu({ filter: dirPath });
    },
    [goal, onGoalChange, atMenu.filter],
  );

  const handleSubmit = useCallback(() => {
    if (atMenu.visible || slashMenu.visible || hashMenu.visible || dollarMenu.visible) return;
    onSubmit();
  }, [atMenu.visible, slashMenu.visible, hashMenu.visible, dollarMenu.visible, onSubmit]);

  const [isFileDragOver, setIsFileDragOver] = useState(false);

  const handleWrapperDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setIsFileDragOver(true);
  }, []);

  const handleWrapperDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setIsFileDragOver(false);
  }, []);

  const handleWrapperDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleWrapperDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragOver(false);
      const merge = onUploadedFilesChange;
      if (!merge) return;
      const files = Array.from(e.dataTransfer.files).filter(isAttachableUpload);
      if (files.length === 0) return;
      const newFiles: UploadedFile[] = files.map(fileToUploadedFile);
      merge([...uploadedFiles, ...newFiles]);
    },
    [uploadedFiles, onUploadedFilesChange],
  );

  const inputPlaceholder = useMemo(() => {
    if (isFileDragOver) {
      return "Drop images or documents here";
    }
    const baseHint = canResume
      ? "Ask a follow-up, use /commands, $skills, @files or #issues to add context"
      : "Ask to edit, use /commands, $skills, @files or #issues to add context";


    if (uploadedFiles.length === 0) {
      return baseHint;
    }

    const hasImages = uploadedFiles.some((f) => f.type === "image");
    const hasDocs = uploadedFiles.some((f) => f.type === "document");

    if (hasImages && hasDocs) {
      return "Ask about your attachments — drop more images or documents here";
    }
    if (hasImages) {
      return uploadedFiles.length === 1
        ? "Ask about this image — drop more files here anytime"
        : "Ask about these images — drop more files here anytime";
    }
    return uploadedFiles.length === 1
      ? "Ask about this document — drop more files here anytime"
      : "Ask about these documents — drop more files here anytime";
  }, [isFileDragOver, uploadedFiles, canResume]);

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
        cursor-pointer transition-all
        ${isFileDragOver ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : ""}`}
      onDragEnter={handleWrapperDragEnter}
      onDragLeave={handleWrapperDragLeave}
      onDragOver={handleWrapperDragOver}
      onDrop={handleWrapperDrop}
    >
      <ContextChips
        contextFiles={contextFiles}
        contextIssues={contextIssues}
        contextSignals={contextSignals}
        contextBrowserSelections={contextBrowserSelections}
        onRemoveContextFile={onRemoveContextFile}
        onRemoveContextIssue={onRemoveContextIssue}
        onRemoveContextSignal={onRemoveContextSignal}
        onRemoveContextBrowserSelection={onRemoveContextBrowserSelection}
      />
      <div className="relative">
        <RichInputForm
          ref={inputRef}
          query={goal}
          onQueryChange={handleGoalChange}
          onSubmit={handleSubmit}
          onSkillChipsChange={handleSkillChipsChange}
          onCaretContextChange={handleCaretContext}
          chipMap={skillChipMap}
          placeholder={inputPlaceholder}
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
