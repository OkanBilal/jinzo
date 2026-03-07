/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useCallback } from "react";
import {
  SendButton,
  DictationButton,
  ModelSelectDropdown,
  FileUploadDropdown,
  FILE_TYPES,
  type UploadedFile,
  Button,
} from "@/components/ui";
import { Plan, Brain } from "@/components/ui/icons";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useClickOutside } from "@/hooks/use-click-outside";

interface InputToolbarProps {
  variant: "claude" | "copilot";
  isLoading: boolean;
  onSubmit: () => void;
  onGoalChange: (value: string) => void;
  // Model
  selectedModelDisplayName: string;
  modelDisplayNames: string[];
  onModelChange: (displayName: string) => void;
  isLoadingModels: boolean;
  // Plan mode (Claude only)
  planMode: boolean;
  onPlanModeToggle: () => void;
  // Thinking mode (Claude only)
  thinkingMode: boolean;
  onThinkingModeToggle: () => void;
  // Stop run (active run is running)
  isRunning: boolean;
  onStop?: () => void;
  // File uploads
  uploadedFiles: UploadedFile[];
  onUploadedFilesChange: (files: UploadedFile[]) => void;
  // Disable send
  disabled?: boolean;
  // Context shortcuts
  onAtClick?: () => void;
  onHashClick?: () => void;
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
  planMode,
  onPlanModeToggle,
  thinkingMode,
  onThinkingModeToggle,
  isRunning,
  onStop,
  uploadedFiles,
  onUploadedFilesChange,
  disabled,
  onAtClick,
  onHashClick,
}: InputToolbarProps) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isRecording, toggle: toggleDictation } = useSpeechRecognition(
    (value) => onGoalChange(value),
  );

  useClickOutside(fileDropdownRef, () => {
    if (showFileDropdown) setShowFileDropdown(false);
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
    <div className="flex items-start space-x-2 px-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center relative gap-1">
          <FileUploadDropdown
            isOpen={showFileDropdown}
            onToggle={() => setShowFileDropdown(!showFileDropdown)}
            onImageUpload={handleImageUpload}
            onDocumentUpload={handleDocumentUpload}
            dropdownRef={fileDropdownRef}
            openUpward={true}
            uploadedFiles={uploadedFiles}
            onRemoveFile={handleRemoveFile}
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
          />
          <button
            type="button"
            onClick={onAtClick}
            className="group flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-100 hover:bg-primary-200/30 dark:hover:bg-primary-600/20 transition-all cursor-pointer"
            title="Add file context (@files)"
          >
            <span className="opacity-60 group-hover:opacity-100 transition-opacity font-mono">@</span>
            <span className="opacity-0 group-hover:opacity-100 transition-all duration-150 max-w-0 group-hover:max-w-10 overflow-hidden whitespace-nowrap">
              files
            </span>
          </button>
          <button
            type="button"
            onClick={onHashClick}
            className="group flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-100 hover:bg-primary-200/30 dark:hover:bg-primary-600/20 transition-all cursor-pointer"
            title="Add issue context (#issues)"
          >
            <span className="opacity-60 group-hover:opacity-100 transition-opacity font-mono">#</span>
            <span className="opacity-0 group-hover:opacity-100 transition-all duration-150 max-w-0 group-hover:max-w-12 overflow-hidden whitespace-nowrap">
              issues
            </span>
          </button>
          {variant === "claude" && (
            <>
              <Button
                tooltip="Toggle Plan Mode"
                type="button"
                onClick={onPlanModeToggle}
                className={`flex items-center gap-1 -ml-1 px-2.5 py-1 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  planMode
                    ? "bg-amber-200/15 text-amber-600 dark:text-amber-200"
                    : " text-primary-700 dark:text-primary-300 hover:bg-primary/10"
                }`}
                title={
                  planMode
                    ? "Plan mode on — agent will plan before acting"
                    : "Plan mode off — agent acts directly"
                }
              >
                <Plan
                  className={`size-3.75 font-medium ${planMode ? "text-amber-600 dark:text-amber-200" : "text-primary-700 dark:text-primary-300"}`}
                />
                Plan
              </Button>
              <Button
                tooltip="Toggle Thinking Mode"
                type="button"
                onClick={onThinkingModeToggle}
                className={`flex items-center px-2 py-1.5  rounded-full text-sm font-medium transition-all cursor-pointer ${
                  thinkingMode
                    ? "bg-primary-500/15 text-primary-600 dark:text-primary-500"
                    : " text-primary-700 dark:text-primary-300 hover:bg-primary/10"
                }`}
                title={
                  thinkingMode
                    ? "Thinking on — model reasons before responding"
                    : "Thinking off — model responds directly"
                }
              >
                <Brain
                  className={`size-3.75 font-medium ${thinkingMode ? "text-primary-600 dark:text-yellow-100" : "text-primary-700 dark:text-primary-300"}`}
                />
                <span
                  className={`transition-all duration-300 ${thinkingMode ? "text-primary-600 ml-1 dark:text-yellow-100 opacity-100 translate-x-0" : "text-primary-900 dark:text-primary-300 opacity-0 translate-x-1"}`}
                >
                  {thinkingMode ? "Think" : ""}
                </span>
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
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
