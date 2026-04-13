/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  SendButton,
  DictationButton,
  ModelSelectDropdown,
  FileUploadDropdown,
  EffortLevelDropdown,
  FastModeButton,
  PermissionModeDropdown,
  FILE_TYPES,
  type UploadedFile,
  Button,
} from "@/components/ui";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useClickOutside } from "@/hooks/use-click-outside";

interface InputToolbarProps {
  variant: "claude" | "copilot" | "codex" | "cursor";
  isLoading: boolean;
  onSubmit: () => void;
  onGoalChange: (value: string) => void;
  // Model
  selectedModelDisplayName: string;
  modelDisplayNames: string[];
  onModelChange: (displayName: string) => void;
  isLoadingModels: boolean;
  // Permission mode (Claude only)
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
  // Thinking mode (Claude only)
  thinkingMode: boolean;
  onThinkingModeToggle: () => void;
  // Fast mode (Claude only)
  fastMode: boolean;
  onFastModeToggle: () => void;
  supportsFastMode: boolean;
  // Effort level (Claude only)
  effortLevel: string;
  onEffortLevelChange: (level: string) => void;
  supportedEffortLevels?: (
    | "minimal"
    | "low"
    | "medium"
    | "high"
    | "max"
    | "xhigh"
  )[];
  // Stop run (active run is running)
  isRunning: boolean;
  onStop?: () => void;
  // File uploads
  uploadedFiles: UploadedFile[];
  onUploadedFilesChange: (files: UploadedFile[]) => void;
  // Disable send
  disabled?: boolean;
}

export function InputToolbar({
  variant,
  isLoading,
  onSubmit,
  onGoalChange,
  selectedModelDisplayName,
  modelDisplayNames,
  onModelChange,
  isLoadingModels,
  permissionMode,
  onPermissionModeChange,
  thinkingMode,
  onThinkingModeToggle,
  fastMode,
  onFastModeToggle,
  supportsFastMode,
  effortLevel,
  onEffortLevelChange,
  supportedEffortLevels,
  isRunning,
  onStop,
  uploadedFiles,
  onUploadedFilesChange,
  disabled,
}: InputToolbarProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [showThinkingDropdown, setShowThinkingDropdown] = useState(false);
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const thinkingDropdownRef = useRef<HTMLDivElement>(null);
  const permissionDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isRecording, toggle: toggleDictation } = useSpeechRecognition(
    (value) => onGoalChange(value),
  );

  useClickOutside(fileDropdownRef, () => {
    if (showFileDropdown) setShowFileDropdown(false);
  });

  useClickOutside(thinkingDropdownRef, () => {
    if (showThinkingDropdown) setShowThinkingDropdown(false);
  });

  useClickOutside(permissionDropdownRef, () => {
    if (showPermissionDropdown) setShowPermissionDropdown(false);
  });

  const openFilePicker = useCallback((accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setShowFileDropdown(false);
  }, []);

  const handleImageUpload = useCallback(() => {
    openFilePicker(FILE_TYPES.IMAGE);
  }, [openFilePicker]);

  const handleDocumentUpload = useCallback(() => {
    openFilePicker(FILE_TYPES.DOCUMENT);
  }, [openFilePicker]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newFiles: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith("image/");
        const uploaded: UploadedFile = {
          file,
          type: isImage ? "image" : "document",
          preview: isImage ? URL.createObjectURL(file) : undefined,
        };
        newFiles.push(uploaded);
      }

      onUploadedFilesChange([...uploadedFiles, ...newFiles]);
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [uploadedFiles, onUploadedFilesChange],
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const file = uploadedFiles[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      onUploadedFilesChange(uploadedFiles.filter((_, i) => i !== index));
    },
    [uploadedFiles, onUploadedFilesChange],
  );

  return (
    <div className="flex items-start space-x-2 px-3 pt-6">
      <div className="flex items-center justify-between w-full">
        <div className={`flex items-center relative ml-1 gap-0.5`}>
          <FileUploadDropdown
              isOpen={showFileDropdown}
              onToggle={() => setShowFileDropdown(!showFileDropdown)}
              onImageUpload={handleImageUpload}
              onDocumentUpload={handleDocumentUpload}
              dropdownRef={fileDropdownRef}
              openUpward={true}
              uploadedFiles={uploadedFiles}
              onRemoveFile={handleRemoveFile}
              variant={variant}
            />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleFileChange}
          />
          <ModelSelectDropdown
            model={selectedModelDisplayName}
            models={modelDisplayNames}
            onModelChange={onModelChange}
            isOpen={showModelDropdown}
            onToggle={() => setShowModelDropdown(!showModelDropdown)}
            onClose={() => setShowModelDropdown(false)}
            dropdownRef={modelDropdownRef}
            openUpward={true}
            isLoading={isLoadingModels}
            variant={variant}
          />
          {(variant === "claude" || variant === "copilot" || variant === "codex" || variant === "cursor") && (
            <>
              <EffortLevelDropdown
                variant={variant}
                thinkingMode={thinkingMode}
                effortLevel={effortLevel}
                onEffortLevelChange={onEffortLevelChange}
                onThinkingModeToggle={onThinkingModeToggle}
                supportedEffortLevels={supportedEffortLevels}
                isOpen={showThinkingDropdown}
                onToggle={() => setShowThinkingDropdown(!showThinkingDropdown)}
                dropdownRef={thinkingDropdownRef}
              />
                            {(variant === "claude" || variant === "cursor" || variant === "codex") && (
                <PermissionModeDropdown
                  permissionMode={permissionMode}
                  onPermissionModeChange={onPermissionModeChange}
                  isOpen={showPermissionDropdown}
                  onToggle={() => setShowPermissionDropdown(!showPermissionDropdown)}
                  dropdownRef={permissionDropdownRef}
                  variant={variant}
                />
              )}
            </>
          )}
          {supportsFastMode && (
            <FastModeButton fastMode={fastMode} onToggle={onFastModeToggle} />
          )}
        </div>
        <div className="flex items-center ">
          <SendButton
            loading={isLoading || isRunning}
            onSubmit={onSubmit}
            onStop={isRunning ? onStop : undefined}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
