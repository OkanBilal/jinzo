import { useReducer, useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useAppDispatch } from "@/lib/redux/hooks";
import type { CommandInfo, SkillInfo } from "@/lib/redux/api/providersApi";
import type { Run } from "../types";
import type { FileNode } from "@/features/workspace/types/file-explorer";
import type { ContextIssue, ContextSignal, ContextSkill, ContextBrowserSelection } from "@/lib/redux/slices/workspaceSlice";
import { addContextFile, addContextIssue, addContextSkill, removeContextSkill } from "@/lib/redux/slices/workspaceSlice";
import type { UploadedFile, RichInputFormHandle, RichSkillChipData, RichFileChipData } from "@/components/ui";
import { useSpaceProviderVariant } from "@/hooks/use-space-provider-variant";
import { useIsMobile } from "@/lib/platform";
import { Button, RichInputForm } from "@/components/ui";
import {
  UnifiedContextDropdown,
  type UnifiedContextTrigger,
} from "@/features/workspace/components/unified-context-dropdown";
import type { IssueWithEntity } from "@/lib/redux/api/entitiesApi";
import { ContextChips } from "./context-chips";
import { InputToolbar } from "./input-toolbar";
import { ContextUsageRing } from "./context-usage-meter";
import { useContextUsage } from "../hooks/use-context-usage";
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
  /** When true (e.g. new-run draft tab active), focus the prompt after layout. */
  isNewRunTabActive?: boolean;
  /** Empty-state stack: tighter outer margins so the bar sits vertically centered with the headline. */
  layout?: "default" | "centered";
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
  isNewRunTabActive = false,
  layout = "default",
}: WorkspaceInputProps) {
  const inputRef = useRef<RichInputFormHandle>(null);
  const unifiedContextDropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  const spaceProvider = useSpaceProviderVariant();
  const providerVariant = spaceProvider.variant;
  const activeProviderId = providerId ?? spaceProvider.providerId;

  const {
    selectedModelDisplayName,
    modelDisplayNames,
    isLoadingModels,
    isFetchingModels,
    handleModelChange,
    providerCommands,
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
    supportsUltracode,
    selectedModelInfo,
    planMode,
    handlePlanModeToggle,
    goalMode,
    handleGoalModeToggle,
  } = useProviderModels(
    activeProviderId,
    providerVariant,
    externalSelectedModel,
    externalOnModelChange,
    workspacePath,
  );

  const contextUsage = useContextUsage(activeRun?.id ?? null);

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

  useEffect(() => {
    if (!isNewRunTabActive) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isNewRunTabActive]);

  const [unifiedMenu, updateUnifiedMenu] = useReducer(
    (
      prev: { visible: boolean; filter: string; trigger: UnifiedContextTrigger },
      next: Partial<{ visible: boolean; filter: string; trigger: UnifiedContextTrigger }>,
    ) => ({ ...prev, ...next }),
    { visible: false, filter: "", trigger: "@" },
  );

  // Detect @ / context menu when goal is set externally (e.g. quick actions)
  useEffect(() => {
    const slashMatch = goal.match(/(?:^|\s)\/(\S*)$/);
    if (slashMatch) {
      updateUnifiedMenu({ filter: slashMatch[1], visible: true, trigger: "/" });
      inputRef.current?.focus();
      return;
    }
    const atMatch = goal.match(/(?:^|\s)@(\S*)$/);
    if (atMatch) {
      updateUnifiedMenu({ filter: atMatch[1], visible: true, trigger: "@" });
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
    const match = before.match(/(?:^|\s)([/@#$])(\S*)$/);
    if (match) {
      updateUnifiedMenu({
        filter: match[2],
        visible: true,
        trigger: match[1] as UnifiedContextTrigger,
      });
    } else {
      updateUnifiedMenu({ visible: false, filter: "" });
    }
  }, []);

  const handleSlashCommandSelect = useCallback(
    (command: CommandInfo) => {
      const replacement = `/${command.name} `;
      const t = unifiedMenu.trigger;
      const ok = inputRef.current?.replaceTokenWithText(t, replacement) ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, t, unifiedMenu.filter, replacement);
        if (next !== null) onGoalChange(next);
      }
      updateUnifiedMenu({ visible: false, filter: "" });
    },
    [goal, onGoalChange, unifiedMenu.filter, unifiedMenu.trigger],
  );

  const handleSkillSelect = useCallback(
    (skill: SkillInfo, trigger: UnifiedContextTrigger) => {
      if (trigger === "#") return; // the issues-only menu never lists skills
      updateUnifiedMenu({ visible: false, filter: "" });
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
      inputRef.current?.replaceTokenWithSkillChip(trigger, {
        name: skill.name,
        displayName: skill.displayName,
        iconSmall: skill.iconSmall,
        iconLarge: skill.iconLarge,
        brandColor: skill.brandColor,
      });
    },
    [dispatch],
  );

  const handleUnifiedSkillSelect = useCallback(
    (skill: SkillInfo) => {
      handleSkillSelect(skill, unifiedMenu.trigger);
    },
    [handleSkillSelect, unifiedMenu.trigger],
  );

  const contextSkillsRef = useRef(contextSkills);
  useEffect(() => {
    contextSkillsRef.current = contextSkills;
  }, [contextSkills]);

  const contextFilesRef = useRef(contextFiles);
  useEffect(() => {
    contextFilesRef.current = contextFiles;
  }, [contextFiles]);

  // When a file is added to context via a non-inline path (file explorer's "Add to context"),
  // there's no `@<path>` token in goal yet — append one so the chip renders and the agent sees
  // the file the same way it sees inline-mentioned ones. Inline picks already write `@<path>`
  // into goal themselves, so the check below skips them.
  const seenContextFilePathsRef = useRef<Set<string>>(
    new Set(contextFiles.map((f) => f.fullPath)),
  );
  useEffect(() => {
    const current = new Set(contextFiles.map((f) => f.fullPath));
    const additions: string[] = [];
    for (const f of contextFiles) {
      if (seenContextFilePathsRef.current.has(f.fullPath)) continue;
      const escaped = f.fullPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`@${escaped}(?![\\w./-])`).test(goal)) continue;
      additions.push(f.fullPath);
    }
    seenContextFilePathsRef.current = current;
    if (additions.length === 0) return;
    const sep = goal.length === 0 || /\s$/.test(goal) ? "" : " ";
    onGoalChange(goal + sep + additions.map((p) => `@${p}`).join(" ") + " ");
  }, [contextFiles, goal, onGoalChange]);

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

  const fileChipMap = useMemo(() => {
    const m = new Map<string, RichFileChipData>();
    for (const f of contextFiles) {
      m.set(f.fullPath, { path: f.fullPath, basename: f.name });
    }
    return m;
  }, [contextFiles]);

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

  const handleFileChipsChange = useCallback(
    (paths: string[]) => {
      const present = new Set(paths);
      for (const file of contextFilesRef.current) {
        if (!present.has(file.fullPath)) {
          onRemoveContextFile?.(file.fullPath);
        }
      }
    },
    [onRemoveContextFile],
  );

  const handleUnifiedFileSelect = useCallback(
    (node: FileNode) => {
      const t = unifiedMenu.trigger;
      if (t === "#" || t === "$") return; // only the combined @ / menu lists files
      // Dispatch first so fileChipMap has the entry by the time the sync effect rebuilds the chip
      // from a rewritten goal string in the dropdown-focus fallback path.
      dispatch(addContextFile(node));
      const ok =
        inputRef.current?.replaceTokenWithFileChip(t, {
          path: node.fullPath,
          basename: node.name,
        }) ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, t, unifiedMenu.filter, `@${node.fullPath} `);
        if (next !== null) onGoalChange(next);
      }
      updateUnifiedMenu({ visible: false, filter: "" });
    },
    [dispatch, goal, onGoalChange, unifiedMenu.filter, unifiedMenu.trigger],
  );

  const handleUnifiedIssueSelect = useCallback(
    (item: IssueWithEntity) => {
      const t = unifiedMenu.trigger;
      const ok = inputRef.current?.replaceTokenWithText(t, "") ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, t, unifiedMenu.filter, "");
        if (next !== null) onGoalChange(next);
      }
      updateUnifiedMenu({ visible: false, filter: "" });
      dispatch(
        addContextIssue({
          entityId: item.issue.entityId,
          title: item.entity.title,
          body: item.entity.body,
          provider: item.issue.provider,
          number: item.issue.number,
          labels: item.issue.labels,
        }),
      );
    },
    [dispatch, goal, onGoalChange, unifiedMenu.filter, unifiedMenu.trigger],
  );

  const handleUnifiedFileNavigate = useCallback(
    (dirPath: string) => {
      const t = unifiedMenu.trigger;
      const replacement = `${t}${dirPath}`;
      const ok = inputRef.current?.replaceTokenWithText(t, replacement) ?? false;
      if (!ok) {
        const next = replaceMentionInGoal(goal, t, unifiedMenu.filter, replacement);
        if (next !== null) onGoalChange(next);
      }
      updateUnifiedMenu({ filter: dirPath });
    },
    [goal, onGoalChange, unifiedMenu.filter, unifiedMenu.trigger],
  );

  const handleSubmit = useCallback(() => {
    if (unifiedMenu.visible) return;
    onSubmit();
  }, [unifiedMenu.visible, onSubmit]);

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

  const isMobile = useIsMobile();
  const inputPlaceholder = useMemo(() => {
    if (isFileDragOver) {
      return "Drop images or documents here";
    }
    // Short, calm placeholder on mobile — the long hint wraps to 2–3 lines on a phone.
    const baseHint = isMobile
      ? "Do anything"
      : canResume
        ? "Ask a follow-up, use @ or / for commands, files, skills and issues"
        : "Ask to edit, use @ or / for commands, files, skills and issues";


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
  }, [isFileDragOver, uploadedFiles, canResume, isMobile]);

  //Copilot related TODO:
  const authErrorMessage = (() => {
    if (!modelsError) return null;
    const msg =
      typeof modelsError === "string"
        ? modelsError
        : typeof modelsError === "object" && "error" in modelsError
          ? String((modelsError as any).error)
          : null;
    if (msg && /not authenticated|gh auth login|cursor login|agent login/i.test(msg)) return msg;
    return null;
  })();


  return (
    <>
          {authErrorMessage && (
        <div className="w-full max-w-200 mx-auto  px-3 py-2 rounded-xl text-yellow-500/80 bg-yellow-500/10  dark:bg-yellow-300/10  dark:text-yellow-200/80 text-xs flex items-center justify-between">
          <span>
            <span className="font-medium">Auth required:</span>{" "}
            {authErrorMessage}
          </span>
          <Button
            type="button"
            variant="subtle"
            onClick={() => void refetchModels()}
            isLoading={isFetchingModels}
            className="ml-3 shrink-0 px-2 py-1 rounded-md bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600/80 dark:text-yellow-200/80 transition-colors cursor-pointer "
          >
            Check Auth
          </Button>
        </div>
      )}

    <div
      className={`relative w-full max-w-200 mx-auto flex flex-col pb-2 rounded-3xl glass-morphism
        cursor-pointer transition-all
        ${layout === "default" ? "mb-4" : ""}
        ${isFileDragOver ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : ""}`}
      onDragEnter={handleWrapperDragEnter}
      onDragLeave={handleWrapperDragLeave}
      onDragOver={handleWrapperDragOver}
      onDrop={handleWrapperDrop}
    >
      {contextUsage && (
        <div className="absolute left-full bottom-2.5 ml-3 z-10">
          <ContextUsageRing usage={contextUsage} />
        </div>
      )}
      <ContextChips
        contextIssues={contextIssues}
        contextSignals={contextSignals}
        contextBrowserSelections={contextBrowserSelections}
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
          onFileChipsChange={handleFileChipsChange}
          onCaretContextChange={handleCaretContext}
          skillChipMap={skillChipMap}
          fileChipMap={fileChipMap}
          placeholder={inputPlaceholder}
        />
        <UnifiedContextDropdown
          isOpen={unifiedMenu.visible}
          trigger={unifiedMenu.trigger}
          filterText={unifiedMenu.filter}
          workspacePath={workspacePath}
          projectId={projectId}
          commands={providerCommands}
          skills={providerSkills}
          isLoadingSkills={isLoadingSkills}
          onSelectCommand={handleSlashCommandSelect}
          onSelectSkill={handleUnifiedSkillSelect}
          onSelectFile={handleUnifiedFileSelect}
          onNavigateFile={handleUnifiedFileNavigate}
          onSelectIssue={handleUnifiedIssueSelect}
          onClose={() => updateUnifiedMenu({ visible: false, filter: "" })}
          dropdownRef={unifiedContextDropdownRef}
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
        planMode={planMode}
        onPlanModeToggle={handlePlanModeToggle}
        goalMode={goalMode}
        onGoalModeToggle={handleGoalModeToggle}
        thinkingMode={thinkingMode}
        onThinkingModeToggle={handleThinkingModeToggle}
        fastMode={fastMode}
        onFastModeToggle={handleFastModeToggle}
        supportsFastMode={selectedModelInfo?.supportsFastMode ?? false}
        effortLevel={effortLevel}
        onEffortLevelChange={handleEffortLevelChange}
        supportedEffortLevels={selectedModelInfo?.supportedEffortLevels}
        supportsUltracode={supportsUltracode}
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
