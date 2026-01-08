import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../lib/redux/hooks';
import { setModelCapabilities } from '../../../lib/redux/slices/chatSlice';

interface ModelCapabilitiesResponse {
  modelName: string;
  supportsThinking: boolean;
  capabilities?: {
    completion?: boolean;
    chat?: boolean;
    embeddings?: boolean;
    tools?: boolean;
    vision?: boolean;
    reasoning?: boolean;
  };
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export function useModelCapabilities() {
  const dispatch = useAppDispatch();
  const selectedModel = useAppSelector((state) => state.chat.selectedModel);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }

    let isMounted = true;

    async function fetchCapabilities() {
      try {
        const data: ModelCapabilitiesResponse = await window.api.ollama.showModel(selectedModel);

        if (isMounted) {
          dispatch(
            setModelCapabilities({
              capabilities: data.capabilities || null,
              supportsThinking: data.supportsThinking,
            })
          );
        }
      } catch (error) {
        console.error('Error fetching model capabilities:', error);
        if (isMounted) {
          dispatch(
            setModelCapabilities({
              capabilities: null,
              supportsThinking: false,
            })
          );
        }
      }
    }

    fetchCapabilities();

    return () => {
      isMounted = false;
    };
  }, [selectedModel, dispatch]);
}
