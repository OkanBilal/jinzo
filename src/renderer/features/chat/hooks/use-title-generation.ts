import { useEffect, useRef, useState } from "react";
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
  const [generatedForSessionId, setGeneratedForSessionId] = useState<number | null>(null);
  const wasLoadingRef = useRef(false);

  const [generateTitle] = useGenerateChatSessionTitleMutation();

  // Generate title after first response completes
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      if (sessionId && shouldGenerate && generatedForSessionId !== sessionId) {
        setGeneratedForSessionId(sessionId);
        generateTitle({ sessionId, model: selectedModel });
      }
    }
    wasLoadingRef.current = isLoading;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sessionId, selectedModel, generateTitle, shouldGenerate]);

  return {
    titleGenerated: generatedForSessionId === sessionId,
  };
}
