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
  DropdownWrapper,
  Body,
} from "@/components/ui";
import { Plan, Brain, Picture, Close } from "@/components/ui/icons";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useClickOutside } from "@/hooks/use-click-outside";
import { Bolt } from "@/components/ui/icons/space";

interface InputToolbarProps {
  variant: "claude" | "copilot" | "codex";
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
  // Fast mode (Claude only)
  fastMode: boolean;
  onFastModeToggle: () => void;
  supportsFastMode: boolean;
  // Effort level (Claude only)
  effortLevel: string;
  onEffortLevelChange: (level: string) => void;
  supportedEffortLevels?: ("minimal" | "low" | "medium" | "high" | "max" | "xhigh")[];
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
  planMode,
  onPlanModeToggle,
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
  const thinkingDropdownRef = useRef<HTMLDivElement>(null);
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
    <div className="flex items-start space-x-2 px-3">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center relative gap-1">
          {variant === "codex" ? (
            <div className="relative flex items-center gap-2" ref={fileDropdownRef}>
              <Button
                type="button"
                tooltip="Upload image"
                tooltipPosition="top"
                onClick={handleImageUpload}
                className="p-1.5 hover:bg-primary-200/30 dark:hover:bg-primary-300/20 rounded-full transition-colors cursor-pointer"
                aria-label="Upload image"
              >
                <Picture className="dark:text-primary-300 size-4 text-primary-700" />
              </Button>
              {uploadedFiles.map((uploadedFile, index) => (
                <div key={`${uploadedFile.file.name}-${uploadedFile.file.size}`} className="relative group">
                  <div className="flex items-center gap-2 bg-primary-100 dark:bg-primary-800 rounded-2xl px-1.5 py-1 mr-1">
                    <div className="relative w-5 h-5 rounded overflow-hidden">
                      <img src={uploadedFile.preview} alt={uploadedFile.file.name} className="w-full h-full object-cover" />
                      <Button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="absolute cursor-pointer inset-0 bg-primary-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        <Close className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                      </Button>
                    </div>
                    <span className="text-primary-700 dark:text-primary-200 text-xs max-w-25 truncate">
                      {uploadedFile.file.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
          )}
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
          {(variant === "claude" || variant === "codex") && (
            <>
              {variant === "claude" && (
              <Button
                tooltip="Toggle Plan Mode"
                type="button"
                onClick={onPlanModeToggle}
                className={`flex items-center gap-1.5  px-2 py-1 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  planMode
                    ? "dark:bg-primary-200/20 bg-primary-500/30 text-primary-700 dark:text-primary-100"
                    : " text-primary-700 dark:text-primary-300 hover:bg-primary/10"
                }`}
                title={
                  planMode
                    ? "Plan mode on — agent will plan before acting"
                    : "Plan mode off — agent acts directly"
                }
              >
                <Plan
                  className={`size-3.5 font-medium ${planMode ? "text-primary-700 dark:text-primary-100" : "text-primary-700 dark:text-primary-300"}`}
                />
                Plan
              </Button>
              )}
              {supportedEffortLevels && supportedEffortLevels.length > 0 ? (
                <div className="relative" ref={thinkingDropdownRef}>
                  <Button
                    tooltip="Thinking & Effort"
                    type="button"
                    onClick={() =>
                      setShowThinkingDropdown(!showThinkingDropdown)
                    }
                    className={`flex items-center  px-2 py-1 -ml-px rounded-full text-sm font-medium transition-all cursor-pointer ${
                      thinkingMode
                        ? "dark:bg-orange-200/10 gap-1 bg-orange-300/30 text-orange-500 dark:text-orange-100"
                        : "text-primary-700 dark:text-primary-300 hover:bg-primary/10"
                    }`}
                  >
                    <Brain
                      className={`size-4 font-medium ${thinkingMode ? "text-orange-500 dark:text-orange-100" : "text-primary-700 dark:text-primary-300"}`}
                    />
                    <span
                      className={
                        thinkingMode
                          ? "text-orange-500 dark:text-orange-100 capitalize"
                          : ""
                      }
                    >
                      {thinkingMode ? effortLevel || "On" : ""}
                    </span>
                  </Button>
                  <DropdownWrapper
                    isOpen={showThinkingDropdown}
                    openUpward={true}
                    minWidth="min-w-32"
                    useFixedBackground={true}
                  >
                    {variant !== "codex" && (
                    <Button
                      type="button"
                      onClick={() => {
                        onEffortLevelChange("");
                        setShowThinkingDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors first:rounded-t-xl ${
                        !thinkingMode
                          ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-500 dark:text-primary-100 font-medium"
                          : "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-300"
                      }`}
                    >
                      Off
                    </Button>
                    )}
                    {supportedEffortLevels.map((level) => (
                      <Button
                        key={level}
                        type="button"
                        onClick={() => {
                          onEffortLevelChange(level);
                          setShowThinkingDropdown(false);
                        }}
                        className={`w-full flex items-center gap-1.5 text-left px-2.5 py-1.5 text-sm cursor-pointer transition-colors capitalize last:rounded-b-xl ${
                          thinkingMode && effortLevel === level
                            ? "bg-primary-200/60 dark:bg-primary-200/8 text-primary-500 dark:text-primary-100 font-medium"
                            : "hover:bg-primary-200/30 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-300"
                        }`}
                      >
                        <Brain className="size-3" />
                        {level}
                      </Button>
                    ))}
                  </DropdownWrapper>
                </div>
              ) : variant === "claude" ? (
                <Button
                  tooltip="Toggle Thinking Mode"
                  type="button"
                  onClick={onThinkingModeToggle}
                  className={`flex items-center gap-1 px-2 py-1 -ml-px rounded-full text-sm font-medium transition-all cursor-pointer ${
                    thinkingMode
                      ? "dark:bg-orange-200/10 bg-orange-300/30 text-orange-500 dark:text-orange-100"
                      : "text-primary-700 dark:text-primary-300 hover:bg-primary/10"
                  }`}
                >
                  <Brain
                    className={`size-4 font-medium ${thinkingMode ? "text-orange-500 dark:text-orange-100" : "text-primary-700 dark:text-primary-300"}`}
                  />
                  <span
                    className={
                      thinkingMode ? "text-orange-500 dark:text-orange-100" : ""
                    }
                  >
                    {thinkingMode ? "Think" : ""}
                  </span>
                </Button>
              ) : null}
            </>
          )}
          {supportsFastMode && (
            <Button
              tooltip="Toggle Fast Mode"
              type="button"
              onClick={onFastModeToggle}
              className={`flex items-center px-2 py-1 -ml-px rounded-full text-sm font-medium transition-all cursor-pointer ${
                fastMode
                  ? "dark:bg-red-300/10 gap-1 bg-red-300/30 text-red-600 dark:text-red-300"
                  : " text-primary-700 dark:text-primary-300 hover:bg-primary/10"
              }`}
              title={
                fastMode
                  ? "Fast mode on — faster output, same model"
                  : "Fast mode off — standard speed"
              }
            >
              <Bolt
                className={`size-4 transition-colors ${fastMode ? "text-red-600 dark:text-red-300" : "text-primary-700 dark:text-primary-300"}`}
                style={{ transitionDelay: fastMode ? "0ms" : "200ms", transitionDuration: "150ms" }}
              />
              <span className="flex overflow-hidden">
                {"Fast".split("").map((char, i) => (
                  <span
                    key={i}
                    className="inline-block text-red-600 dark:text-red-300"
                    style={{
                      transition: "opacity 150ms, transform 150ms, max-width 150ms",
                      transitionDelay: fastMode ? `${i * 40}ms` : `${(3 - i) * 40}ms`,
                      opacity: fastMode ? 1 : 0,
                      transform: fastMode ? "translateX(0)" : "translateX(4px)",
                      maxWidth: fastMode ? "1ch" : "0px",
                    }}
                  >
                    {char}
                  </span>
                ))}
              </span>
            </Button>
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
