import { useMemo } from "react";
import { useAppSelector } from "../../../lib/redux/hooks";

const THINKING_MODELS = {
  GPT_OSS: "gpt-oss",
  QWEN_3: "qwen3",
  DEEPSEEK_V3: "deepseek-v3",
  DEEPSEEK_R1: "deepseek-r1",
} as const;

export interface ThinkingConfig {
  supportsThinking: boolean;
  supportsThinkingLevels: boolean;
  canToggleThinking: boolean;
  shouldShowThinkingLevel: boolean;
  shouldShowThinkingToggle: boolean;
  modelType: "gpt-oss" | "other-thinking" | "standard";
}

export function useThinkingConfig(): ThinkingConfig {
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);
  const supportsThinking = useAppSelector(
    (state) => state.chat.supportsThinking
  );

  const config = useMemo(() => {
    const modelLower = selectedModel.toLowerCase();

    const isGptOss = modelLower.includes(THINKING_MODELS.GPT_OSS);

    const isQwen3 = modelLower.includes(THINKING_MODELS.QWEN_3);
    const isDeepSeekV3 = modelLower.includes(THINKING_MODELS.DEEPSEEK_V3);
    const isDeepSeekR1 = modelLower.includes(THINKING_MODELS.DEEPSEEK_R1);

    const isOtherThinkingModel = isQwen3 || isDeepSeekV3 || isDeepSeekR1;

    const modelSupportsThinking =
      supportsThinking || isGptOss || isOtherThinkingModel;

    let modelType: ThinkingConfig["modelType"] = "standard";
    if (isGptOss) {
      modelType = "gpt-oss";
    } else if (modelSupportsThinking) {
      modelType = "other-thinking";
    }

    return {
      supportsThinking: modelSupportsThinking,
      supportsThinkingLevels: isGptOss,
      canToggleThinking: modelSupportsThinking && !isGptOss,
      shouldShowThinkingLevel: isGptOss,
      shouldShowThinkingToggle: modelSupportsThinking && !isGptOss,
      modelType,
    };
  }, [selectedModel, supportsThinking]);

  return config;
}

export function modelSupportsThinking(modelName: string): boolean {
  const modelLower = modelName.toLowerCase();
  return (
    modelLower.includes(THINKING_MODELS.GPT_OSS) ||
    modelLower.includes(THINKING_MODELS.QWEN_3) ||
    modelLower.includes(THINKING_MODELS.DEEPSEEK_V3) ||
    modelLower.includes(THINKING_MODELS.DEEPSEEK_R1)
  );
}

export function modelSupportsThinkingLevels(modelName: string): boolean {
  const modelLower = modelName.toLowerCase();
  return modelLower.includes(THINKING_MODELS.GPT_OSS);
}
