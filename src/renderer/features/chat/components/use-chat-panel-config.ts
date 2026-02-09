import { useState, useEffect } from "react";
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
  type StructuredOutputSchema,
} from "@/lib/redux/slices/chatSlice";
import { useThinkingConfig } from "@/features/chat/hooks/use-thinking-config";
import { useModelCapabilities } from "@/features/chat/hooks/use-model-capabilities";
import { getModelIcon } from "@/lib/model-icons";

export function useChatPanelConfig() {
  const dispatch = useAppDispatch();
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const thinkingLevel = useAppSelector((state) => state.chat.thinkingLevel);
  const thinkingEnabled = useAppSelector((state) => state.chat.thinkingEnabled);
  const toolMode = useAppSelector((state) => state.chat.toolMode);
  const structuredOutputEnabled = useAppSelector(
    (state) => state.chat.structuredOutputEnabled,
  );
  const structuredOutputSchema = useAppSelector(
    (state) => state.chat.structuredOutputSchema,
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
    schema: StructuredOutputSchema,
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

  return {
    selectedModel,
    thinkingLevel,
    thinkingEnabled,
    toolMode,
    structuredOutputEnabled,
    structuredOutputSchema,
    config,
    thinkingConfig,
    isStructuredOutputModalOpen,
    modelOptions,
    toolModeOptions,
    handleTemperatureChange,
    handleModelChange,
    handleThinkingLevelChange,
    handleThinkingEnabledChange,
    handleToolModeChange,
    handleStructuredOutputEnabledChange,
    handleStructuredOutputSchemaChange,
    setIsStructuredOutputModalOpen,
  };
}
