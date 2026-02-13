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

  const thinkingConfig = useThinkingConfig();
  useModelCapabilities();

  const [isStructuredOutputModalOpen, setIsStructuredOutputModalOpen] =
    useState(false);

  const { data: config } = useGetChatConfigQuery();
  const { data: modelsData } = useGetOllamaModelsQuery();
  const [updateConfig] = useUpdateChatConfigMutation();

  useEffect(() => {
    if (config) {
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

  const handleTopPChange = async (value: number) => {
    await updateConfig({ top_p: value });
  };

  const handleStopSequenceChange = async (sequences: string[]) => {
    await updateConfig({ stop: sequences });
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

  const handleToolModeChange = (mode: "chat" | "rag" | "tool") => {
    dispatch(setToolMode(mode));
    updateConfig({ toolMode: mode });
  };

  // Derived state: useTools is true when toolMode is "tool"
  const useTools = toolMode === "tool";

  // For display in select: show "chat" when toolMode is "chat" or "tool"
  const displayMode = toolMode === "tool" ? "chat" : toolMode;

  const handleDisplayModeChange = (mode: "chat" | "rag") => {
    // When changing display mode, reset to base mode (not "tool")
    dispatch(setToolMode(mode));
    updateConfig({ toolMode: mode });
  };

  const handleUseToolsChange = (enabled: boolean) => {
    const newMode = enabled ? "tool" : "chat";
    dispatch(setToolMode(newMode));
    updateConfig({ toolMode: newMode });
  };

  const modelOptions = models.map((model) => ({
    value: model,
    label: model,
    icon: getModelIcon(model),
  }));

  const toolModeOptions = [
    { value: "chat" as const, label: "Chat" },
    { value: "rag" as const, label: "RAG" },
  ];

  return {
    selectedModel,
    thinkingLevel,
    thinkingEnabled,
    toolMode,
    useTools,
    displayMode,
    config,
    thinkingConfig,
    isStructuredOutputModalOpen,
    modelOptions,
    toolModeOptions,
    handleTemperatureChange,
    handleTopPChange,
    handleStopSequenceChange,
    handleModelChange,
    handleThinkingLevelChange,
    handleThinkingEnabledChange,
    handleToolModeChange,
    handleDisplayModeChange,
    handleUseToolsChange,
    setIsStructuredOutputModalOpen,
  };
}
