import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  useGetProviderModelsQuery,
  useGetProviderCommandsQuery,
  useGetProviderSkillsQuery,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  type CommandInfo,
  type SkillInfo,
} from "@/lib/redux/api/providersApi";
import { setWorkspaceModel } from "@/lib/redux/slices/workspaceSlice";
import type { RootState } from "@/lib/redux";
import { getContextIssueColor } from "@/lib/label-colors";
import type { Run } from "../types";
import type { FileNode } from "@/features/file-explorer";
import type { ContextIssue } from "@/lib/redux/slices/workspaceSlice";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useClickOutside } from "@/hooks/use-click-outside";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { SendButton } from "@/components/ui/input/send-button";
import { DictationButton } from "@/components/ui/input/dictation-button";
import { InputForm } from "@/components/ui/input/input-form";
import {
  FileUploadDropdown,
  FILE_TYPES,
  type UploadedFile,
} from "@/components/ui/input/file-upload-dropdown";
import { ModelSelectDropdown } from "@/components/ui/input/model-select-dropdown";
import { SlashMenuDropdown } from "@/features/workspace/components/slash-menu-dropdown";
import { Asana, Close, Plan } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Jira } from "@/components/ui/icons";
import { Code } from "@/components/ui/icons/mood";
import { Button } from "@/components/ui/button";

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
  /** Workspace root path for discovering project-level skills */
  workspacePath?: string;
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
  contextFiles = [],
  onRemoveContextFile,
  contextIssues = [],
  onRemoveContextIssue,
  workspacePath,
}: WorkspaceInputProps) {
  const dispatch = useDispatch();
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const slashCommandDropdownRef = useRef<HTMLDivElement>(null);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashFilterText, setSlashFilterText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const variant = useWorkspaceVariant();

  const defaultProviderId =
    variant === "claude" ? "claude_code" : "copilot_cli";
  const activeProviderId = providerId ?? defaultProviderId;

  // Get persisted model for this provider from Redux
  const persistedModel = useSelector(
    (state: RootState) =>
      state.workspace.selectedModelByProvider[activeProviderId],
  );

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));
  useClickOutside(slashCommandDropdownRef, () => setShowSlashCommands(false));

  // Fetch models from provider
  const { data: providerModels, isLoading: isLoadingModels } =
    useGetProviderModelsQuery(activeProviderId, { skip: !activeProviderId });

  // Fetch commands from provider (for slash menu dropdown)
  const { data: providerCommands = [], isLoading: isLoadingCommands } =
    useGetProviderCommandsQuery(activeProviderId, { skip: !activeProviderId });

  // Fetch skills from provider (for slash menu dropdown)
  //TODO: works with Claude so make available for claude for now
  const { data: providerSkills = [], isLoading: isLoadingSkills } =
    useGetProviderSkillsQuery(
      { id: activeProviderId, workspacePath },
      { skip: !activeProviderId },
    );

  // Fetch provider config for plan mode toggle (Claude only)
  const { data: providerData } = useGetProviderByIdQuery(activeProviderId, {
    skip: variant !== "claude",
  });
  const [updateProvider] = useUpdateProviderMutation();
  const planMode = !!(providerData?.config as any)?.planMode;

  const handlePlanModeToggle = useCallback(async () => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          planMode: !planMode,
        },
      },
    });
  }, [providerData, planMode, activeProviderId, updateProvider]);

  // Compute model list and display names
  const { modelDisplayNames } = useMemo(() => {
    if (providerModels && providerModels.length > 0) {
      return {
        modelDisplayNames: providerModels.map((m) => m.displayName),
        modelIds: providerModels.map((m) => m.id),
      };
    }
    return { modelDisplayNames: [], modelIds: [] };
  }, [providerModels]);

  // Use external, persisted (Redux), or derive from provider models
  const selectedModel = externalSelectedModel ?? persistedModel ?? "";
  const setSelectedModel = (model: string) => {
    if (externalOnModelChange) {
      externalOnModelChange(model);
    }
    // Always persist to Redux for this provider
    dispatch(setWorkspaceModel({ providerId: activeProviderId, model }));
  };

  // Get display name for current model
  const selectedModelDisplayName = useMemo(() => {
    if (providerModels) {
      const model = providerModels.find((m) => m.id === selectedModel);
      return model?.displayName ?? selectedModel;
    }
    return selectedModel;
  }, [providerModels, selectedModel]);

  // Set default model when models are loaded (only if no persisted model)
  useEffect(() => {
    if (providerModels && providerModels.length > 0 && !selectedModel) {
      const defaultModel =
        providerModels.find((m) => m.isDefault) ?? providerModels[0];
      setSelectedModel(defaultModel.id);
    }
  }, [providerModels, selectedModel, activeProviderId]);

  // Handle model change from dropdown (which uses display names)
  const handleModelChange = (displayName: string) => {
    if (providerModels) {
      const model = providerModels.find((m) => m.displayName === displayName);
      if (model) {
        setSelectedModel(model.id);
        return;
      }
    }
    // Fallback: use as-is if not found
    setSelectedModel(displayName);
  };

  // Handle goal change with slash command detection
  const handleGoalChange = useCallback(
    (value: string) => {
      onGoalChange(value);

      // Detect slash command pattern: "/" at start or after whitespace
      const slashMatch = value.match(/(?:^|\s)\/(\S*)$/);
      if (slashMatch) {
        const filterText = slashMatch[1]; // Text after the slash
        setSlashFilterText(filterText);
        setShowSlashCommands(true);
      } else {
        setShowSlashCommands(false);
        setSlashFilterText("");
      }
    },
    [onGoalChange],
  );

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback(
    (command: CommandInfo) => {
      // Replace the slash and any partial text with the selected command
      const newGoal = goal.replace(/(?:^|\s)\/\S*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}/${command.name} `;
      });
      onGoalChange(newGoal);
      setShowSlashCommands(false);
      setSlashFilterText("");
    },
    [goal, onGoalChange],
  );

  // Handle skill selection
  const handleSkillSelect = useCallback(
    (skill: SkillInfo) => {
      // Replace the slash and any partial text with the selected skill
      const newGoal = goal.replace(/(?:^|\s)\/\S*$/, (match) => {
        const prefix = match.startsWith(" ") ? " " : "";
        return `${prefix}/${skill.name} `;
      });
      onGoalChange(newGoal);
      setShowSlashCommands(false);
      setSlashFilterText("");
    },
    [goal, onGoalChange],
  );

  const { isRecording, toggle: toggleDictation } = useSpeechRecognition(
    (value) => onGoalChange(value),
  );

  const handleImageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = FILE_TYPES.IMAGE;
      fileInputRef.current.click();
    }
    setIsDropdownOpen(false);
  };

  const handleDocumentUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = FILE_TYPES.DOCUMENT;
      fileInputRef.current.click();
    }
    setIsDropdownOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith("image/");
      const uploadedFile: UploadedFile = {
        file,
        type: isImage ? "image" : "document",
      };
      if (isImage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          uploadedFile.preview = reader.result as string;
          setUploadedFiles((prev) => [...prev, uploadedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles((prev) => [...prev, uploadedFile]);
      }
    }
    event.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const glassMorphismClass =
    variant === "claude" ? "glass-morphism-claude" : "glass-morphism-copilot";

  return (
    <div
      className={`w-200 mb-4 mx-auto flex flex-col pb-2 rounded-3xl ${glassMorphismClass}
        cursor-pointer transition-all`}
    >
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          contextFiles.length > 0 || contextIssues.length > 0
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
            {contextFiles.map((file) => (
              <div
                key={file.fullPath}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/8 text-xs text-primary-700 dark:text-primary-300"
              >
                <Code className="w-3 h-3" />
                <span className="truncate max-w-37.5">{file.name}</span>
                {onRemoveContextFile && (
                  <button
                    onClick={() => onRemoveContextFile(file.fullPath)}
                    className="w-4 h-4 flex items-center justify-center rounded p-0.5 hover:bg-primary/20 dark:hover:bg-primary/10 transition-colors"
                    title="Remove from context"
                  >
                    <Close className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {contextIssues.map((issue) => (
              <div
                key={issue.entityId}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${getContextIssueColor(issue.labels, issue.provider)}`}
              >
                {issue.provider === "github" ? (
                  <Github className="w-3 h-3" />
                ) : issue.provider === "linear" ? (
                  <Linear className="w-3 h-3" />
                ) : issue.provider === "jira" ? (
                  <Jira className="w-3 h-3" />
                ) : issue.provider === "asana" ? (
                  <Asana className="w-3 h-3" />
                ) : (
                  <span className="text-[10px] font-medium uppercase">
                    {issue.provider.slice(0, 2)}
                  </span>
                )}
                <span className="truncate max-w-37.5">{issue.title}</span>
                {onRemoveContextIssue && (
                  <button
                    onClick={() => onRemoveContextIssue(issue.entityId)}
                    className="w-4 h-4 flex items-center justify-center rounded p-0.5 hover:bg-purple-500/20 dark:hover:bg-purple-500/10 transition-colors"
                    title="Remove from context"
                  >
                    <Close className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="relative">
        <InputForm
          query={goal}
          onQueryChange={handleGoalChange}
          onSubmit={onSubmit}
          placeholder={
            canResume
              ? "Ask a follow-up question, run /commands"
              : "Ask to edit, run /commands, or add issues/files to context"
          }
          variant={variant}
        />
        <SlashMenuDropdown
          commands={providerCommands}
          skills={providerSkills}
          isOpen={showSlashCommands}
          onSelectCommand={handleSlashCommandSelect}
          onSelectSkill={handleSkillSelect}
          onClose={() => setShowSlashCommands(false)}
          dropdownRef={slashCommandDropdownRef}
          filterText={slashFilterText}
          variant={variant}
          isLoadingCommands={isLoadingCommands}
          isLoadingSkills={isLoadingSkills}
        />
      </div>
      <div className="flex items-start space-x-2 px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center relative gap-1">
            <FileUploadDropdown
              isOpen={isDropdownOpen}
              onToggle={() => setIsDropdownOpen(!isDropdownOpen)}
              onImageUpload={handleImageUpload}
              onDocumentUpload={handleDocumentUpload}
              dropdownRef={dropdownRef}
              openUpward={true}
              uploadedFiles={uploadedFiles}
              onRemoveFile={handleRemoveFile}
              variant={variant}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <ModelSelectDropdown
              model={selectedModelDisplayName}
              models={modelDisplayNames}
              onModelChange={handleModelChange}
              isOpen={showModelDropdown}
              onToggle={() => setShowModelDropdown(!showModelDropdown)}
              onClose={() => setShowModelDropdown(false)}
              dropdownRef={modelDropdownRef}
              openUpward={true}
              variant={variant}
              isLoading={isLoadingModels}
            />
            {variant === "claude" && (
              <Button
                tooltip="Toggle Plan Mode"
                type="button"
                onClick={handlePlanModeToggle}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  planMode
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-500"
                    : " text-primary-500 dark:text-primary-400 hover:bg-primary/10"
                }`}
                title={
                  planMode
                    ? "Plan mode on — agent will plan before acting"
                    : "Plan mode off — agent acts directly"
                }
              >
                <Plan
                  className={`size-4.5 ${planMode ? "text-amber-600 dark:text-amber-500" : "text-primary-500 dark:text-primary-400"}`}
                />
                Plan
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <DictationButton
              isRecording={isRecording}
              onToggle={toggleDictation}
              variant={variant}
            />
            <SendButton
              loading={isLoading}
              onSubmit={onSubmit}
              variant={variant}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
