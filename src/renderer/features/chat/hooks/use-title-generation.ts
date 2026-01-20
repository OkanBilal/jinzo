import { useEffect, useRef } from "react";
import { useGenerateChatSessionTitleMutation } from "@/lib/redux/api";

interface UseTitleGenerationOptions {
  sessionId: number | null;
  selectedModel: string;
  isLoading: boolean;
  shouldGenerate: boolean;
}

export function useTitleGeneration({
  sessionId,
  selectedModel,
  isLoading,
  shouldGenerate,
}: UseTitleGenerationOptions) {
  const titleGeneratedRef = useRef(false);
  const wasLoadingRef = useRef(false);

  const [generateTitle] = useGenerateChatSessionTitleMutation();

  // Reset when session changes
  useEffect(() => {
    titleGeneratedRef.current = false;
  }, [sessionId]);

  // Generate title after first response completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      if (sessionId && shouldGenerate && !titleGeneratedRef.current) {
        titleGeneratedRef.current = true;
        generateTitle({ sessionId, model: selectedModel });
      }
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, sessionId, selectedModel, generateTitle, shouldGenerate]);

  return {
    titleGenerated: titleGeneratedRef.current,
  };
}
