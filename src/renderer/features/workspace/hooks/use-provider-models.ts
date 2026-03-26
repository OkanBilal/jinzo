import { useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  useGetProviderModelsQuery,
  useGetProviderCommandsQuery,
  useGetProviderSkillsQuery,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api/providersApi";
import { setWorkspaceModel } from "@/lib/redux/slices/workspaceSlice";
import type { RootState } from "@/lib/redux";

export function useProviderModels(
  activeProviderId: string,
  variant: "claude" | "copilot" | "codex",
  externalSelectedModel?: string,
  externalOnModelChange?: (model: string) => void,
  workspacePath?: string,
) {
  const dispatch = useDispatch();

  const persistedModel = useSelector(
    (state: RootState) =>
      state.workspace.selectedModelByProvider[activeProviderId],
  );

  const { data: providerModels, isLoading: isLoadingModels, error: modelsError } =
    useGetProviderModelsQuery(activeProviderId, { skip: !activeProviderId });

  const { data: providerCommands = [], isLoading: isLoadingCommands } =
    useGetProviderCommandsQuery(activeProviderId, { skip: !activeProviderId });

  const { data: providerSkills = [], isLoading: isLoadingSkills } =
    useGetProviderSkillsQuery(
      { id: activeProviderId, workspacePath },
      { skip: !activeProviderId || variant !== "claude" },
    );

  const { data: providerData } = useGetProviderByIdQuery(activeProviderId, {
    skip: variant !== "claude" && variant !== "codex",
  });
  const [updateProvider] = useUpdateProviderMutation();
  const permissionMode: string = (providerData?.config as any)?.permissionMode ?? "default";
  const thinkingMode = variant === "codex"
    ? !!(providerData?.config as any)?.modelReasoningEffort
    : !!(providerData?.config as any)?.thinkingMode;
  const fastMode = !!(providerData?.config as any)?.fastMode;
  const effortLevel: string = variant === "codex"
    ? (providerData?.config as any)?.modelReasoningEffort || ""
    : (providerData?.config as any)?.effortLevel || "";

  const handlePermissionModeChange = useCallback(async (mode: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          permissionMode: mode,
        },
      },
    });
  }, [providerData, activeProviderId, updateProvider]);

  const handleThinkingModeToggle = useCallback(async () => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          thinkingMode: !thinkingMode,
        },
      },
    });
  }, [providerData, thinkingMode, activeProviderId, updateProvider]);

  const handleFastModeToggle = useCallback(async () => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          fastMode: !fastMode,
        },
      },
    });
  }, [providerData, fastMode, activeProviderId, updateProvider]);

  const handleEffortLevelChange = useCallback(async (level: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    if (variant === "codex") {
      // Codex uses modelReasoningEffort in its config
      await updateProvider({
        id: activeProviderId,
        payload: {
          config: {
            ...currentConfig,
            modelReasoningEffort: level || undefined,
          },
        },
      });
    } else {
      // Claude uses thinkingMode + effortLevel
      const enableThinking = !!level;
      await updateProvider({
        id: activeProviderId,
        payload: {
          config: {
            ...currentConfig,
            thinkingMode: enableThinking,
            effortLevel: level || undefined,
          },
        },
      });
    }
  }, [providerData, activeProviderId, updateProvider, variant]);

  const { modelDisplayNames } = useMemo(() => {
    if (providerModels && providerModels.length > 0) {
      return {
        modelDisplayNames: providerModels.map((m) => m.displayName),
      };
    }
    return { modelDisplayNames: [] };
  }, [providerModels]);

  const selectedModel = externalSelectedModel ?? persistedModel ?? "";
  const setSelectedModel = useCallback(
    (model: string) => {
      externalOnModelChange?.(model);
      dispatch(setWorkspaceModel({ providerId: activeProviderId, model }));
    },
    [externalOnModelChange, dispatch, activeProviderId],
  );

  const selectedModelDisplayName = useMemo(() => {
    if (providerModels) {
      const model = providerModels.find((m) => m.id === selectedModel);
      return model?.displayName ?? selectedModel;
    }
    return selectedModel;
  }, [providerModels, selectedModel]);

  const selectedModelInfo = useMemo(() => {
    if (providerModels) {
      return providerModels.find((m) => m.id === selectedModel) ?? null;
    }
    return null;
  }, [providerModels, selectedModel]);

  useEffect(() => {
    if (providerModels && providerModels.length > 0 && !selectedModel) {
      const defaultModel =
        providerModels.find((m) => m.isDefault) ?? providerModels[0];
      setSelectedModel(defaultModel.id);
    }
  }, [providerModels, selectedModel, setSelectedModel]);

  const handleModelChange = useCallback(
    (displayName: string) => {
      if (providerModels) {
        const model = providerModels.find((m) => m.displayName === displayName);
        if (model) {
          setSelectedModel(model.id);
          return;
        }
      }
      setSelectedModel(displayName);
    },
    [providerModels, setSelectedModel],
  );

  return {
    selectedModel,
    selectedModelDisplayName,
    modelDisplayNames,
    isLoadingModels,
    handleModelChange,
    providerCommands,
    isLoadingCommands,
    providerSkills,
    isLoadingSkills,
    modelsError,
    permissionMode,
    handlePermissionModeChange,
    thinkingMode,
    handleThinkingModeToggle,
    fastMode,
    handleFastModeToggle,
    effortLevel,
    handleEffortLevelChange,
    selectedModelInfo,
  };
}
