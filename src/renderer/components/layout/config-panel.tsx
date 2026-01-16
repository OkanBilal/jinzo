import { useState, useEffect, useCallback } from "react";
import { Config, ConfigClose } from "@/components/ui/icons";
import { Heading3, Body } from "@/components/ui/text";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { FrostedButton } from "@/components/ui/button";
import Select from "@/components/ui/select";
import {
  useGetChatConfigQuery,
  useUpdateChatConfigMutation,
  useGetOllamaModelsQuery,
  useGetAppsQuery,
} from "@/lib/redux/api";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  setSelectedModel,
  setThinkingLevel,
  setThinkingEnabled,
  setToolMode,
  setStructuredOutputEnabled,
  setStructuredOutputSchema,
  type StructuredOutputSchema,
} from "@/lib/redux/slices/chatSlice";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { useModelCapabilities } from "@/features/chat/hooks/use-model-capabilities";
import { StructuredOutputModal } from "@/components/layout/config-panel/structured-output-modal";
import { getModelIcon } from "@/lib/model-icons";
import { useActiveMood } from "@/hooks/useActiveMood";
import { ChatMessages } from "@/features/chat/components";
import ChatInput from "@/features/chat/components/input";
import { AppState } from "@/features/chat/components/input/types";
import { useChat } from "@/features/chat/hooks/use-chat";

const FADE_IN_DELAY = 50;

interface ConfigPanelProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  width?: string;
}

export default function ConfigPanel({
  isOpen,
  onToggle,
  width = "40rem",
}: ConfigPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { isWritingMood } = useActiveMood();

  const handleToggle = () => onToggle(!isOpen);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen) {
      timer = setTimeout(() => setIsVisible(true), FADE_IN_DELAY);
    } else {
      timer = setTimeout(() => setIsVisible(false), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <>
      <FrostedButton
        onClick={handleToggle}
        className={`fixed z-40 p-2.5 rounded-full transition-all duration-300 ease-out ${
          isOpen ? "right-[calc(var(--config-width)+1.75rem)]" : "top-7 right-5"
        }`}
        style={
          isOpen
            ? ({
                "--config-width": width,
                top: "1.75rem",
              } as React.CSSProperties)
            : ({ top: "1.75rem", right: "1.25rem" } as React.CSSProperties)
        }
        aria-label={isOpen ? "Close configuration" : "Open configuration"}
      >
        {isOpen ? (
          <ConfigClose className="w-4.5 h-4.5" />
        ) : (
          <Config className="w-4.5 h-4.5" />
        )}
      </FrostedButton>
      <div
        className={`block fixed top-0 bottom-0 right-0 overflow-hidden transition-all duration-300 ease-out bg-transparent ${
          isVisible ? "translate-x-0 z-50 " : "pointer-events-none"
        }`}
        style={{
          width: width,
          transform: isVisible ? "translateX(0)" : `translateX(${width})`,
          zIndex: isVisible ? 50 : -10,
        }}
        role="complementary"
        aria-label="Configuration panel"
      >
        {!isWritingMood ? (
          <div className="flex items-center justify-between px-4 pt-6 ">
            <Heading3>Configuration</Heading3>
          </div>
        ) : null}
        {isWritingMood ? <WritingConfigContent /> : <PanelContent />}
      </div>
    </>
  );
}

function PanelContent() {
  const dispatch = useAppDispatch();
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const thinkingLevel = useAppSelector((state) => state.chat.thinkingLevel);
  const thinkingEnabled = useAppSelector((state) => state.chat.thinkingEnabled);
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const structuredOutputEnabled = useAppSelector(
    (state) => state.chat.structuredOutputEnabled
  );
  const structuredOutputSchema = useAppSelector(
    (state) => state.chat.structuredOutputSchema
  );

  const thinkingConfig = useThinkingConfig();
  useModelCapabilities();

  const [isStructuredOutputModalOpen, setIsStructuredOutputModalOpen] =
    useState(false);

  const { data: config } = useGetChatConfigQuery();
  const { data: modelsData } = useGetOllamaModelsQuery();
  const [updateConfig] = useUpdateChatConfigMutation();

  useEffect(() => {
    if (config) {
      if (config.structuredOutputEnabled !== undefined) {
        dispatch(setStructuredOutputEnabled(config.structuredOutputEnabled));
      }
      if (config.structuredOutputSchema) {
        dispatch(setStructuredOutputSchema(config.structuredOutputSchema));
      }
      if (config.toolMode) {
        dispatch(setToolMode(config.toolMode));
      }
      if (config.selectedModel) {
        dispatch(setSelectedModel(config.selectedModel));
      }
    }
  }, [config, dispatch]);

  const models = Array.isArray(modelsData?.models) ? modelsData.models : [];

  const handleTemperatureChange = async (value: number) => {
    await updateConfig({ temperature: value });
  };

  const handleModelChange = (model: string) => {
    dispatch(setSelectedModel(model));
    updateConfig({ selectedModel: model });
  };

  const handleThinkingLevelChange = (level: "low" | "medium" | "high") => {
    dispatch(setThinkingLevel(level));
  };

  const handleThinkingEnabledChange = (enabled: boolean) => {
    dispatch(setThinkingEnabled(enabled));
  };

  const handleToolModeChange = (mode: "chat" | "rag" | "mcp") => {
    dispatch(setToolMode(mode));
    updateConfig({ toolMode: mode });
  };

  const handleStructuredOutputEnabledChange = (enabled: boolean) => {
    dispatch(setStructuredOutputEnabled(enabled));
    updateConfig({ structuredOutputEnabled: enabled });
  };

  const handleStructuredOutputSchemaChange = (
    schema: StructuredOutputSchema
  ) => {
    dispatch(setStructuredOutputSchema(schema));
    updateConfig({ structuredOutputSchema: schema });

    if (schema.properties.length === 0) {
      dispatch(setStructuredOutputEnabled(false));
      updateConfig({ structuredOutputEnabled: false });
    }
  };

  const modelOptions = models.map((model) => ({
    value: model,
    label: model,
    icon: getModelIcon(model),
  }));

  const toolModeOptions = [
    { value: "chat" as const, label: "Chat" },
    { value: "rag" as const, label: "RAG" },
    { value: "mcp" as const, label: "MCP" },
  ];

  return (
    <div className="flex-1 overflow-auto noscrollbar p-3">
      <div className="flex flex-col gap-4">
        <ConfigSection title="Model">
          <Select
            value={selectedModel}
            options={modelOptions}
            onChange={handleModelChange}
            placeholder="Select model"
          />
        </ConfigSection>

        {thinkingConfig.supportsThinking && (
          <ConfigSection title="Thinking">
            {thinkingConfig.shouldShowThinkingLevel && (
              <Select
                value={thinkingLevel}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
                onChange={handleThinkingLevelChange}
                placeholder="Select thinking level"
              />
            )}
            {thinkingConfig.shouldShowThinkingToggle && (
              <Toggle
                enabled={thinkingEnabled}
                onChange={handleThinkingEnabledChange}
                label="Enable Thinking"
              />
            )}
          </ConfigSection>
        )}

        <ConfigSection title="Temperature">
          <Slider
            value={config?.temperature ?? 0.7}
            onChange={handleTemperatureChange}
            min={0}
            max={2}
            step={0.01}
            label="Temperature"
            minLabel="More Focused"
            maxLabel="More Creative"
          />
        </ConfigSection>

        <ConfigSection title="Tools">
          <Select
            value={toolMode}
            options={toolModeOptions}
            onChange={handleToolModeChange}
            placeholder="Select tool mode"
          />
          {toolMode !== "mcp" && (
            <StructuredOutputToggle
              enabled={structuredOutputEnabled}
              onChange={handleStructuredOutputEnabledChange}
              onEditClick={() => setIsStructuredOutputModalOpen(true)}
            />
          )}
        </ConfigSection>

        <ConfigSection title="Advanced">
          <Body className="text-primary-500 dark:text-primary-400 text-sm mb-12">
            Advanced configuration options will appear here.
          </Body>
        </ConfigSection>
      </div>

      <StructuredOutputModal
        isOpen={isStructuredOutputModalOpen}
        onClose={() => setIsStructuredOutputModalOpen(false)}
        schema={structuredOutputSchema}
        onSave={handleStructuredOutputSchemaChange}
      />
    </div>
  );
}

function WritingConfigContent() {
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const thinkingEnabled = useAppSelector((state) => state.chat.thinkingEnabled);
  const thinkingLevel = useAppSelector((state) => state.chat.thinkingLevel);
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const structuredOutputEnabled = useAppSelector(
    (state) => state.chat.structuredOutputEnabled
  );
  const structuredOutputSchema = useAppSelector(
    (state) => state.chat.structuredOutputSchema
  );

  const thinkingConfig = useThinkingConfig();

  const [selectedApp, setSelectedApp] = useState<AppState | null>(null);
  const { data: apps = [] } = useGetAppsQuery();

  const {
    messages,
    input,
    setInput,
    isLoading,
    sendMessageStreaming,
    focusInput,
    refs: { messagesRef },
  } = useChat({ initialMessages: [] });

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const handleSend = useCallback((): void => {
    if (!input.trim()) return;

    sendMessageStreaming(selectedModel, {
      requestOptions: {
        mode: toolMode,
        thinkingEnabled: thinkingConfig.shouldShowThinkingToggle
          ? thinkingEnabled
          : undefined,
        thinkingLevel: thinkingConfig.shouldShowThinkingLevel
          ? thinkingLevel
          : undefined,
        structuredOutputEnabled,
        structuredOutputSchema,
      },
    });
  }, [
    input,
    selectedModel,
    sendMessageStreaming,
    toolMode,
    thinkingConfig,
    thinkingEnabled,
    thinkingLevel,
    structuredOutputEnabled,
    structuredOutputSchema,
  ]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 bg-primary-950/70 mx-3 -pb-4  rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-hidden ">
        <ChatMessages
          ref={messagesRef}
          messages={messages}
          isLoading={isLoading}
        />
      </div>
      <div className="shrink-0 p-3 pb-6">
        <ChatInput
          apps={apps}
          query={input}
          onQueryChange={setInput}
          onSubmit={handleSend}
          loading={isLoading}
          placeholder="Message"
          isChatPage={true}
          selectedApp={selectedApp}
          onSelectedAppChange={setSelectedApp}
        />
      </div>
    </div>
  );
}

interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
}

function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div className="p-1 ">
      <Body className="font-semibold mb-2 text-primary-800 dark:text-primary-200">
        {title}
      </Body>
      {children}
    </div>
  );
}

interface StructuredOutputToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  onEditClick: () => void;
}

function StructuredOutputToggle({
  enabled,
  onChange,
  onEditClick,
}: StructuredOutputToggleProps) {
  return (
    <div className="flex items-center justify-between p-1 mt-2">
      <div className="flex flex-col">
        <Body className="text-sm text-primary-800 dark:text-primary-200">
          Structured Outputs
        </Body>
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <button
            onClick={onEditClick}
            className="px-2.5 py-1 text-xs font-medium text-primary-700 dark:text-primary-300 bg-black/4 dark:bg-white/6 rounded-lg hover:bg-black/6 dark:hover:bg-white/8 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0.5px_2px_rgba(0,0,0,0.3)] ${
            enabled
              ? "bg-blue-500 dark:bg-blue-600"
              : "bg-black/8 dark:bg-white/15"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
