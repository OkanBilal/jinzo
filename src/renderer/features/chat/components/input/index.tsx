import { useState, useRef, useEffect } from "react";

import { useSpeechRecognition } from "../../../../hooks/use-speech-recognition";
import { useClickOutside } from "../../../../hooks/use-click-outside";
import { useEscapeKey } from "../../../../hooks/use-escape-key";
import {
  useGetOllamaModelsQuery,
  useUpdateChatConfigMutation,
} from "../../../../lib/redux/api";
import { useAppDispatch, useAppSelector } from "../../../../lib/redux/hooks";
import {
  setSelectedModel,
  setWebSearchEnabled,
} from "../../../../lib/redux/slices/chatSlice";
import { SendButton } from "@/components/ui/input/send-button";
import { DictationButton } from "@/components/ui/input/dictation-button";
import { InputForm } from "@/components/ui/input/input-form";
import {
  FileUploadDropdown,
  FILE_TYPES,
  type UploadedFile,
} from "@/components/ui/input/file-upload-dropdown";
import { ModelSelectDropdown } from "@/components/ui/input/model-select-dropdown";
import { WebSearchDropdown } from "@/components/ui/input/web-search-dropdown";
import { ChatInputProps } from "./types";

const DEFAULT_PLACEHOLDER = "Ask jinzo anything...";

export default function ChatInput({
  query,
  onQueryChange,
  context,
  onSubmit,
  placeholder = DEFAULT_PLACEHOLDER,
  loading = false,
  className,
}: ChatInputProps) {
  const dispatch = useAppDispatch();
  const model = useAppSelector((state) => state.chat.selectedModel);
  const webSearchEnabled = useAppSelector(
    (state) => state.chat.webSearchEnabled,
  );
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const { data: modelsData } = useGetOllamaModelsQuery();
  const [updateConfig] = useUpdateChatConfigMutation();
  const models = modelsData?.models || [];
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isWebSearchDropdownOpen, setIsWebSearchDropdownOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const webSearchDropdownRef = useRef<HTMLDivElement>(null);

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

  const { isRecording, toggle: toggleDictation } =
    useSpeechRecognition(onQueryChange);

  const handleModelChange = (newModel: string) => {
    dispatch(setSelectedModel(newModel));
    updateConfig({ selectedModel: newModel });
  };

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));
  useClickOutside(modelDropdownRef, () => setIsModelDropdownOpen(false));
  useClickOutside(webSearchDropdownRef, () =>
    setIsWebSearchDropdownOpen(false),
  );

  useEscapeKey(() => {
    setIsDropdownOpen(false);
    setIsModelDropdownOpen(false);
    setIsWebSearchDropdownOpen(false);
  });

  const handleWebSearchToggle = (enabled: boolean) => {
    dispatch(setWebSearchEnabled(enabled));
    updateConfig({ webSearchEnabled: enabled });
  };

  const handleQueryChange = (value: string) => {
    onQueryChange(value);
  };

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

  return (
    <div
      className={`w-full flex flex-col pb-2 rounded-3xl glass-morphism
    cursor-pointer transition-all ${className || ""}`}
    >
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          context?.entityId && context?.body
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-2 pt-3 -mb-1">
            <div className="flex items-center gap-2 text-xs text-primary-800 dark:text-primary-400 px-2 ">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="truncate">{context?.title || "Untitled"}</span>
              <span className="text-primary-800 dark:text-primary-400">•</span>
              <span>{context?.wordCount} words</span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative">
        <InputForm
          ref={inputRef}
          query={query}
          onQueryChange={handleQueryChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
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
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            {toolMode === "chat" && (
              <WebSearchDropdown
                isOpen={isWebSearchDropdownOpen}
                onToggle={() =>
                  setIsWebSearchDropdownOpen(!isWebSearchDropdownOpen)
                }
                dropdownRef={webSearchDropdownRef}
                openUpward={true}
                webSearchEnabled={webSearchEnabled}
                onWebSearchToggle={handleWebSearchToggle}
              />
            )}
            <ModelSelectDropdown
              model={model}
              models={models}
              onModelChange={handleModelChange}
              isOpen={isModelDropdownOpen}
              onToggle={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              dropdownRef={modelDropdownRef}
              openUpward={true}
            />
          </div>
          <div className="flex items-center space-x-2">
            <DictationButton
              isRecording={isRecording}
              onToggle={toggleDictation}
            />
            <SendButton loading={loading} onSubmit={onSubmit} />
          </div>
        </div>
      </div>
    </div>
  );
}
