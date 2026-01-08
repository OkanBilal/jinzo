"use client";
import { useState, useEffect, useSyncExternalStore, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Asterisk,
  Close,
  Config,
  ConfigClose,
  Trash,
  DeepSeek,
  Gpt,
  Meta,
} from "@/components/ui/icons";
import Text, { Heading3, Body, Caption } from "@/components/ui/text";
import Select from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import NumberFlow from "@number-flow/react";
import {
  useGetChatConfigQuery,
  useUpdateChatConfigMutation,
  useGetOllamaModelsQuery,
} from "@/lib/redux/api";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import {
  setSelectedModel,
  setThinkingLevel,
  setThinkingEnabled,
  setToolMode,
  setStructuredOutputEnabled,
  setStructuredOutputSchema,
  type StructuredOutputProperty,
  type StructuredOutputSchema,
} from "@/lib/redux/slices/chatSlice";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { useModelCapabilities } from "@/features/chat/hooks/use-model-capabilities";
import { useClickOutside } from "@/features/chat/hooks/use-click-outside";
import { Button } from "@/components/ui/button";

const FADE_IN_DELAY = 50;

export default function ConfigPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleToggle = () => setIsOpen(!isOpen);

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
      <button
        onClick={handleToggle}
        className={`block fixed z-40 p-2.5 bg-primary-50/70 rounded-3xl dark:bg-primary-850 backdrop-blur cursor-pointer transition-all duration-300 ${
          isOpen ? "top-6 right-75" : "top-6 right-4"
        }`}
        aria-label={isOpen ? "Close configuration" : "Open configuration"}
      >
        {isOpen ? (
          <ConfigClose className="w-4.5 h-4.5 text-primary-800 dark:text-primary-100 " />
        ) : (
          <Config className="w-4.5 h-4.5 text-primary-800 dark:text-primary-100 " />
        )}
      </button>
      <div
        className={`block fixed dark:bg-primary-850 top-4 bottom-4 right-4 w-70 rounded-3xl overflow-auto transition-all duration-300 ease-out ${
          isVisible
            ? " noscrollbar translate-x-0 z-50"
            : " translate-x-74 -z-10 pointer-events-none"
        }`}
        role="complementary"
        aria-label="Configuration panel"
      >
        <div className="flex items-center justify-between p-4">
          <Heading3>Configuration</Heading3>
        </div>
        <PanelContent />
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

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isToolModeDropdownOpen, setIsToolModeDropdownOpen] = useState(false);
  const [isStructuredOutputModalOpen, setIsStructuredOutputModalOpen] =
    useState(false);

  const { data: config } = useGetChatConfigQuery();
  const { data: modelsData } = useGetOllamaModelsQuery();
  const [updateConfig] = useUpdateChatConfigMutation();

  // Sync Redux state with persisted config on load
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
    setIsModelDropdownOpen(false);
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
    setIsToolModeDropdownOpen(false);
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

    // Auto-disable structured output if schema is empty
    if (schema.properties.length === 0) {
      dispatch(setStructuredOutputEnabled(false));
      updateConfig({ structuredOutputEnabled: false });
    }
  };

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="flex flex-col gap-4">
        <ConfigSection title="Model">
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onChange={handleModelChange}
            isOpen={isModelDropdownOpen}
            onToggle={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
          />
        </ConfigSection>
        {thinkingConfig.supportsThinking && (
          <ConfigSection title="Thinking">
            {thinkingConfig.shouldShowThinkingLevel && (
              <ThinkingLevelSelector
                value={thinkingLevel}
                onChange={handleThinkingLevelChange}
              />
            )}
            {thinkingConfig.shouldShowThinkingToggle && (
              <ThinkingToggle
                enabled={thinkingEnabled}
                onChange={handleThinkingEnabledChange}
              />
            )}
          </ConfigSection>
        )}
        <ConfigSection title="Temperature">
          <TemperatureSlider
            value={config?.temperature ?? 0.7}
            onChange={handleTemperatureChange}
          />
        </ConfigSection>
        <ConfigSection title="Tools">
          <ToolModeSelector
            value={toolMode}
            onChange={handleToolModeChange}
            isOpen={isToolModeDropdownOpen}
            onToggle={() => setIsToolModeDropdownOpen(!isToolModeDropdownOpen)}
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
          <Body className="text-primary-500 dark:text-primary-400 text-sm">
            Advanced configuration options will appear here.
          </Body>
        </ConfigSection>
      </div>
      <StructuredOutputModalPortal
        isOpen={isStructuredOutputModalOpen}
        onClose={() => setIsStructuredOutputModalOpen(false)}
        schema={structuredOutputSchema}
        onSave={handleStructuredOutputSchemaChange}
      />
    </div>
  );
}

// Modal rendered at root level via portal
const emptySubscribe = () => () => {};

function StructuredOutputModalPortal({
  isOpen,
  onClose,
  schema,
  onSave,
}: StructuredOutputModalProps) {
  const isBrowser = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isBrowser || !isOpen) return null;

  return createPortal(
    <StructuredOutputModal
      isOpen={isOpen}
      onClose={onClose}
      schema={schema}
      onSave={onSave}
    />,
    document.body
  );
}

interface ConfigSectionProps {
  title: string;
  children: React.ReactNode;
}

function ConfigSection({ title, children }: ConfigSectionProps) {
  return (
    <div className="p-2 ">
      <Body className="font-semibold mb-2 text-primary-800 dark:text-primary-200">
        {title}
      </Body>
      {children}
    </div>
  );
}

interface TemperatureSliderProps {
  value: number;
  onChange: (value: number) => void;
}

function TemperatureSlider({ value, onChange }: TemperatureSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
  };

  const handleMouseUp = () => {
    onChange(localValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Caption className="text-primary-600 dark:text-primary-300">
          Temperature
        </Caption>
        <Caption className="text-primary-700 dark:text-primary-200 font-mono">
          <NumberFlow
            value={localValue}
            format={{
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }}
          />
        </Caption>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="0.01"
        value={localValue}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className="w-full h-1.5 bg-primary-200 dark:bg-primary-800 rounded-lg appearance-none cursor-pointer slider"
      />
      <div className="flex justify-between">
        <Caption className="text-primary-500 dark:text-primary-400 text-xs">
          More Focused
        </Caption>
        <Caption className="text-primary-500 dark:text-primary-400 text-xs">
          More Creative
        </Caption>
      </div>
    </div>
  );
}

interface ModelSelectorProps {
  models: string[];
  selectedModel: string;
  onChange: (model: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function getModelIcon(modelName: string) {
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes("deepseek")) {
    return <DeepSeek className="w-4 h-4" />;
  }
  if (lowerName.includes("gpt")) {
    return <Gpt className="w-4 h-4" />;
  }
  if (lowerName.includes("llama")) {
    return <Meta className="w-4 h-4" />;
  }
  if (lowerName.includes("gemma")) {
    return <span className="text-sm">💎</span>;
  }
  if (lowerName.includes("mistral")) {
    return <span className="text-sm">🌀</span>;
  }
  if (lowerName.includes("qwen")) {
    return <span className="text-sm">🌐</span>;
  }
  return <span className="text-sm">⚡</span>;
}

function ModelSelector({
  models,
  selectedModel,
  onChange,
  isOpen,
  onToggle,
}: ModelSelectorProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useClickOutside(dropdownRef, () => {
    if (isOpen) onToggle();
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        className="w-full px-2.5 py-2 rounded-2xl bg-primary-50 dark:bg-primary-900 border border-primary-200 dark:border-primary-800/50 text-primary-800 dark:text-primary-200 text-sm focus:outline-none cursor-pointer flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          {getModelIcon(selectedModel)}
          <span>{selectedModel || "Select model"}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <DropdownWrapper
        isOpen={isOpen}
        minWidth="w-full"
        usePortal={true}
        triggerRef={buttonRef}
        dropdownRef={dropdownRef}
      >
        <div className="max-h-60 overflow-auto">
          {models.map((model) => (
            <button
              type="button"
              key={model}
              onClick={() => {
                if (model !== selectedModel) {
                  onChange(model);
                }
                onToggle();
              }}
              className={`w-full cursor-pointer text-left transition-colors px-2.5 py-2 first:rounded-t-xl last:rounded-b-xl hover:bg-primary-100 dark:hover:bg-primary-600/20 text-sm flex items-center gap-2 ${
                selectedModel === model
                  ? "bg-primary-200 dark:bg-primary-800/50 text-primary-900 dark:text-primary-100 font-medium"
                  : "hover:bg-primary-100 dark:hover:bg-primary-600/20 text-primary-700 dark:text-primary-200"
              }`}
            >
              {getModelIcon(model)}
              <span className="truncate">{model}</span>
            </button>
          ))}
        </div>
      </DropdownWrapper>
    </div>
  );
}

interface ThinkingToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function ThinkingToggle({ enabled, onChange }: ThinkingToggleProps) {
  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex flex-col">
        <Body className="text-sm text-primary-800 dark:text-primary-200">
          Enable Thinking
        </Body>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled
            ? "bg-primary-600 dark:bg-primary-500"
            : "bg-primary-300 dark:bg-primary-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

interface ThinkingLevelSelectorProps {
  value: "low" | "medium" | "high";
  onChange: (level: "low" | "medium" | "high") => void;
}

function ThinkingLevelSelector({
  value,
  onChange,
}: ThinkingLevelSelectorProps) {
  const levelToNumber = useMemo(() => ({ low: 0, medium: 1, high: 2 }), []);
  const numberToLevel = ["low", "medium", "high"] as const;

  const [localValue, setLocalValue] = useState(() => levelToNumber[value]);

  useEffect(() => {
    setLocalValue(levelToNumber[value]);
  }, [value, levelToNumber]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    setLocalValue(newValue);
  };

  const handleMouseUp = () => {
    onChange(numberToLevel[localValue]);
  };

  const levelLabels = ["Low", "Medium", "High"];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Caption className="text-primary-600 dark:text-primary-300">
          Thinking Level
        </Caption>
        <Caption className="text-primary-700 dark:text-primary-200 font-medium">
          {levelLabels[localValue]}
        </Caption>
      </div>
      <input
        type="range"
        min="0"
        max="2"
        step="1"
        value={localValue}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className="w-full h-1.5 bg-primary-200 dark:bg-primary-800 rounded-lg appearance-none cursor-pointer slider"
      />
      <div className="flex justify-between">
        <Caption className="text-primary-500 dark:text-primary-400 text-xs">
          Fast
        </Caption>
        <Caption className="text-primary-500 dark:text-primary-400 text-xs">
          Balanced
        </Caption>
        <Caption className="text-primary-500 dark:text-primary-400 text-xs">
          Deep
        </Caption>
      </div>
    </div>
  );
}

interface ToolModeSelectorProps {
  value: "chat" | "rag" | "mcp";
  onChange: (mode: "chat" | "rag" | "mcp") => void;
  isOpen: boolean;
  onToggle: () => void;
}

function ToolModeSelector({
  value,
  onChange,
  isOpen,
  onToggle,
}: ToolModeSelectorProps) {
  const options = [
    {
      value: "chat",
      label: "Chat",
      description: "Standard chat mode",
    },
    {
      value: "rag",
      label: "RAG",
      description: "Retrieval augmented generation",
    },
    { value: "mcp", label: "MCP", description: "Model context protocol" },
  ];

  return (
    <Select
      value={value}
      options={options}
      onChange={(val) => onChange(val as "chat" | "rag" | "mcp")}
      isOpen={isOpen}
      onToggle={onToggle}
      placeholder="Select tool mode"
      showDescription
    />
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
    <div className="flex items-center justify-between p-2 mt-2">
      <div className="flex flex-col">
        <Body className="text-sm text-primary-800 dark:text-primary-200">
          Structured Outputs
        </Body>
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <button
            onClick={onEditClick}
            className="px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-800 rounded-md hover:bg-primary-200 dark:hover:bg-primary-700 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled
              ? "bg-primary-600 dark:bg-primary-500"
              : "bg-primary-300 dark:bg-primary-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

interface StructuredOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: StructuredOutputSchema;
  onSave: (schema: StructuredOutputSchema) => void;
}

function StructuredOutputModal({
  isOpen,
  onClose,
  schema,
  onSave,
}: StructuredOutputModalProps) {
  const [localProperties, setLocalProperties] = useState<
    StructuredOutputProperty[]
  >([]);
  const [initialized, setInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize state when modal opens
  if (isOpen && !initialized) {
    setLocalProperties(schema.properties);
    setInitialized(true);
  }

  // Reset initialized flag when modal closes
  if (!isOpen && initialized) {
    setInitialized(false);
  }

  // Check if any property name is empty
  const hasEmptyPropertyName = localProperties.some(
    (prop) => prop.name.trim() === ""
  );
  const canSave = localProperties.length === 0 || !hasEmptyPropertyName;

  const handleAddProperty = () => {
    setLocalProperties([
      ...localProperties,
      { name: "", type: "string", isArray: false, isRequired: false },
    ]);
  };

  const handleUpdateProperty = (
    index: number,
    updates: Partial<StructuredOutputProperty>
  ) => {
    const updated = [...localProperties];
    updated[index] = { ...updated[index], ...updates };
    setLocalProperties(updated);
  };

  const handleRemoveProperty = (index: number) => {
    setLocalProperties(localProperties.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    setLocalProperties([]);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);

    try {
      // Add minimum 200ms delay to show loading state
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 500)),
        (async () => {
          onSave({ properties: localProperties });

          // Auto-disable structured output if no properties
          if (localProperties.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        })(),
      ]);

      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-40 w-full max-w-200 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 backdrop-blur-2xl dark:border-primary-900 rounded-3xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          animation: "scaleIn 150ms ease-out",
        }}
      >
        <div className="flex items-center justify-between p-4">
          <Heading3>Structured outputs</Heading3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full cursor-pointer text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
          >
            <Close className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="min-h-75 max-h-75 overflow-y-auto overflow-x-visible">
            <div className="space-y-3 flex-col">
              <Text className="uppercase tracking-wide">Property</Text>
              {localProperties.map((prop, index) => (
                <PropertyRow
                  key={index}
                  property={prop}
                  onUpdate={(updates) => handleUpdateProperty(index, updates)}
                  onRemove={() => handleRemoveProperty(index)}
                />
              ))}
              <Button onClick={handleAddProperty} variant="secondary">
                + Add property
              </Button>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-primary-800">
          <Button onClick={handleReset} variant="ghost" size="sm">
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            isLoading={isSaving}
            variant="primary"
            size="sm"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PropertyRowProps {
  property: StructuredOutputProperty;
  onUpdate: (updates: Partial<StructuredOutputProperty>) => void;
  onRemove: () => void;
}

function PropertyRow({ property, onUpdate, onRemove }: PropertyRowProps) {
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const typeOptions = [
    { value: "string", label: "string" },
    { value: "number", label: "number" },
    { value: "boolean", label: "boolean" },
    { value: "array", label: "array" },
    { value: "object", label: "object" },
  ];

  const isNameEmpty = property.name.trim() === "";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <Input
          type="text"
          value={property.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Property name"
          hasError={isNameEmpty}
          className="w-full rounded-xl!"
        />
      </div>
      <div className="w-32 shrink-0">
        <Select
          value={property.type}
          options={typeOptions}
          onChange={(val) =>
            onUpdate({
              type: val as StructuredOutputProperty["type"],
            })
          }
          isOpen={isTypeDropdownOpen}
          onToggle={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
          placeholder="Type"
        />
      </div>
      <button
        onClick={() => onUpdate({ isArray: !property.isArray })}
        className={`shrink-0 px-2.5 py-2 border rounded-xl text-sm transition-colors ${
          property.isArray
            ? "bg-primary-900 border-primary-600 text-primary-200"
            : "bg-primary-950 border-primary-800 text-primary-500"
        }`}
        title="Is Array"
      >
        [ ]
      </button>
      <button
        onClick={() => onUpdate({ isRequired: !property.isRequired })}
        className={`shrink-0 py-2.5 px-2 border rounded-xl text-sm transition-colors ${
          property.isRequired
            ? "bg-primary-900 border-primary-600 text-primary-200"
            : "bg-primary-950 border-primary-800 text-primary-500"
        }`}
        title="Required"
      >
        <Asterisk className="w-4 h-4" />
      </button>
      <button
        onClick={onRemove}
        className="shrink-0 p-2 text-primary-500 cursor-pointer hover:text-red-400 transition-colors"
        title="Remove"
      >
        <Trash className="w-4 h-4" />
      </button>
    </div>
  );
}
