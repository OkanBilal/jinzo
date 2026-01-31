import { useState, useRef, useEffect, useMemo } from "react";
import { useGetProviderModelsQuery } from "@/lib/redux/api/providersApi";
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
import { Close } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Code } from "@/components/ui/icons/mood";

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
}: WorkspaceInputProps) {
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [internalSelectedModel, setInternalSelectedModel] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const variant = useWorkspaceVariant();

  const defaultProviderId =
    variant === "claude" ? "claude_code" : "copilot_cli";
  const activeProviderId = providerId ?? defaultProviderId;

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  // Fetch models from provider
  const { data: providerModels, isLoading: isLoadingModels } =
    useGetProviderModelsQuery(activeProviderId, { skip: !activeProviderId });

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

  // Use external or internal selected model
  const selectedModel = externalSelectedModel ?? internalSelectedModel;
  const setSelectedModel = externalOnModelChange ?? setInternalSelectedModel;

  // Get display name for current model
  const selectedModelDisplayName = useMemo(() => {
    if (providerModels) {
      const model = providerModels.find((m) => m.id === selectedModel);
      return model?.displayName ?? selectedModel;
    }
    return selectedModel;
  }, [providerModels, selectedModel]);

  // Set default model when models are loaded
  useEffect(() => {
    if (providerModels && providerModels.length > 0 && !selectedModel) {
      const defaultModel =
        providerModels.find((m) => m.isDefault) ?? providerModels[2];
        console.log("Setting default model to:", defaultModel.id);
        console.log("Default model display name:", defaultModel.displayName);
        console.log("Provider Models:", providerModels);
      setSelectedModel(defaultModel.id);
    }
  }, [providerModels, selectedModel, setSelectedModel]);

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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 dark:bg-purple-500/15 text-xs text-purple-700 dark:text-purple-300"
              >
                {issue.provider === "github" ? (
                  <Github className="w-3 h-3" />
                ) : issue.provider === "linear" ? (
                  <Linear className="w-3 h-3" />
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
          onQueryChange={onGoalChange}
          onSubmit={onSubmit}
          placeholder={
            canResume
              ? "Ask to make changes, @mention files, run /commands"
              : "Ask to make changes, @mention files, run /commands"
          }
          variant={variant}
        />
      </div>
      <div className="flex items-start space-x-2 px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center relative">
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
            />
          </div>
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
  );
}
