import { useAppSelector } from "@/lib/redux/hooks";
import { useThinkingConfig } from "./use-thinking-config";

//TODO: FİX ERRORS

export function useChatConfig() {
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
  const webSearchEnabled = useAppSelector(
    (state) => state.chat.webSearchEnabled
  );

  const thinkingConfig = useThinkingConfig();

  const getRequestOptions = () => ({
    mode: toolMode,
    thinkingEnabled: thinkingConfig.shouldShowThinkingToggle
      ? thinkingEnabled
      : undefined,
    thinkingLevel: thinkingConfig.shouldShowThinkingLevel
      ? thinkingLevel
      : undefined,
    structuredOutputEnabled,
    structuredOutputSchema,
    webSearchEnabled,
  });

  return {
    selectedModel,
    thinkingEnabled,
    thinkingLevel,
    toolMode,
    structuredOutputEnabled,
    structuredOutputSchema,
    thinkingConfig,
    getRequestOptions,
  };
}
