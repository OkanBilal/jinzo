"use client";

import { useState, useRef, useMemo, useEffect } from "react";

import SettingsModal from "../../../../features/settings/components/settings-modal";
import { useSpeechRecognition } from "../../../../features/chat/hooks/use-speech-recognition";
import { useClickOutside } from "../../../../features/chat/hooks/use-click-outside";
import { useEscapeKey } from "../../../../features/chat/hooks/use-escape-key";
import { useGetOllamaModelsQuery } from "../../../../lib/redux/api";
import { useAppDispatch, useAppSelector } from "../../../../lib/redux/hooks";
import {
  setSelectedModel,
  //setToolMode
} from "../../../../lib/redux/slices/chatSlice";
import AppMentionDropdown from "../../../../features/chat/components/input/app-mention-dropdown";
import ConnectAppsDropdown from "../../../../features/chat/components/input/connect-apps-dropdown";
import DictationButton from "../../../../features/chat/components/input/dictation-button";
import FileUploadDropdown, {
  FILE_TYPES,
} from "../../../../features/chat/components/input/file-upload-dropdown";
import InputForm from "../../../../features/chat/components/input/input-form";
import ModelSelectDropdown from "../../../../features/chat/components/input/model-select-dropdown";
//import McpToggleButton from "@/features/chat/components/input/mcp-toggle-button";
import SendButton from "./send-button";
import { ChatInputProps, AppState, UploadedFile } from "./types";

const DEFAULT_PLACEHOLDER = "Ask laurel anything...";

export default function ChatInput({
  query,
  onQueryChange,
  apps,
  onSubmit,
  placeholder = DEFAULT_PLACEHOLDER,
  loading = false,
  isChatPage = false,
  selectedApp,
  onSelectedAppChange,
  className,
  //onMcpModeChange,
}: ChatInputProps) {
  const dispatch = useAppDispatch();
  const model = useAppSelector((state) => state.chat.selectedModel);
  // const toolMode = useAppSelector((state) => state.chat.toolMode);
  const { data: modelsData } = useGetOllamaModelsQuery();
  const models = modelsData?.models || [];
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isAppsDropdownOpen, setIsAppsDropdownOpen] = useState(false);
  const [isAppsModalOpen, setIsAppsModalOpen] = useState(false);
  const [isAppMentionOpen, setIsAppMentionOpen] = useState(false);
  const [appSearchTerm, setAppSearchTerm] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

  const appsDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const appMentionDropdownRef = useRef<HTMLDivElement>(null);

  const { isRecording, toggle: toggleDictation } =
    useSpeechRecognition(onQueryChange);

  const handleModelChange = (newModel: string) => {
    dispatch(setSelectedModel(newModel));
  };

  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));
  useClickOutside(modelDropdownRef, () => setIsModelDropdownOpen(false));
  useClickOutside(appsDropdownRef, () => setIsAppsDropdownOpen(false));
  useClickOutside(appMentionDropdownRef, () => setIsAppMentionOpen(false));

  useEscapeKey(() => {
    setIsDropdownOpen(false);
    setIsModelDropdownOpen(false);
    setIsAppsDropdownOpen(false);
    setIsAppsModalOpen(false);
    setIsAppMentionOpen(false);
  });

  useEffect(() => {
    queueMicrotask(() => {
      const lastChar = query.slice(-1);
      const queryBeforeAt = query.slice(0, -1);

      if (
        lastChar === "@" &&
        (queryBeforeAt === "" || queryBeforeAt.endsWith(" "))
      ) {
        setIsAppMentionOpen(true);
        setAppSearchTerm("");
        return;
      }
      if (!query.includes("@")) {
        setIsAppMentionOpen(false);
        setAppSearchTerm("");
        return;
      }
      const lastAtIndex = query.lastIndexOf("@");
      const afterAt = query.slice(lastAtIndex + 1);

      if (afterAt.includes(" ")) {
        setIsAppMentionOpen(false);
        setAppSearchTerm("");
      } else {
        setAppSearchTerm(afterAt);
      }
    });
  }, [query]);

  const handleAppSelect = (app: AppState) => {
    const lastAtIndex = query.lastIndexOf("@");
    const queryBeforeAt = query.slice(0, lastAtIndex);
    const newQuery = `${queryBeforeAt}@${app.displayName} `;
    onQueryChange(newQuery);
    setIsAppMentionOpen(false);

    if (onSelectedAppChange) {
      onSelectedAppChange(app);
    }
  };

  const handleQueryChange = (value: string) => {
    onQueryChange(value);
    if (selectedApp && !value.includes(`@${selectedApp.displayName}`)) {
      if (onSelectedAppChange) {
        onSelectedAppChange(null);
      }
    }
  };

  const handleClearSelectedApp = () => {
    if (onSelectedAppChange) {
      onSelectedAppChange(null);
    }
    if (selectedApp && query.includes(`@${selectedApp.displayName}`)) {
      const newQuery = query.replace(`@${selectedApp.displayName}`, "").trim();
      onQueryChange(newQuery);
    }
  };

  const toggleAppsDropdown = () => setIsAppsDropdownOpen((v) => !v);
  const openAppsModal = () => {
    setIsAppsDropdownOpen(false);
    setIsAppsModalOpen(true);
  };
  const closeAppsModal = () => setIsAppsModalOpen(false);

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
    <div className={`w-full flex flex-col pb-2 rounded-3xl bg-primary-50 dark:bg-primary-900 ${className || ''}`}>
      <div className="relative">
        <InputForm
          query={query}
          onQueryChange={handleQueryChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
        />
        <AppMentionDropdown
          isOpen={isAppMentionOpen}
          apps={apps}
          onSelectApp={handleAppSelect}
          dropdownRef={appMentionDropdownRef}
          openUpward={isChatPage}
          searchTerm={appSearchTerm}
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
              openUpward={isChatPage}
              uploadedFiles={uploadedFiles}
              onRemoveFile={handleRemoveFile}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <ConnectAppsDropdown
              isOpen={isAppsDropdownOpen}
              onToggle={toggleAppsDropdown}
              apps={apps}
              connectedApps={connectedApps}
              onOpenModal={openAppsModal}
              dropdownRef={appsDropdownRef}
              openUpward={isChatPage}
              selectedApp={selectedApp}
              onClearSelectedApp={handleClearSelectedApp}
            />
            {/* <McpToggleButton
              enabled={toolMode === 'mcp'}
              onToggle={() => {
                const newMode = toolMode === 'mcp' ? 'rag' : 'mcp';
                dispatch(setToolMode(newMode));
                if (onMcpModeChange) {
                  onMcpModeChange(newMode === 'mcp');
                }
              }}
            /> */}
            <ModelSelectDropdown
              model={model}
              models={models}
              onModelChange={handleModelChange}
              isOpen={isModelDropdownOpen}
              onToggle={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              dropdownRef={modelDropdownRef}
              openUpward={isChatPage}
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
      <SettingsModal
        open={isAppsModalOpen}
        apps={apps}
        connectedApps={connectedApps}
        onClose={closeAppsModal}
        section="apps"
      />
    </div>
  );
}
