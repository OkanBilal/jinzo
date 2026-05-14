import { useEffect, useMemo, useCallback } from "react";
import {
  useGetProviderModelsQuery,
  useGetProviderCommandsQuery,
  useGetProviderSkillsQuery,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
  type ModelInfo,
} from "@/lib/redux/api/providersApi";
import { setWorkspaceModel } from "@/lib/redux/slices/workspaceSlice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";

function getModelPrettyName(model: ModelInfo, variant: string): string {
  if (variant !== "claude" || !model.description) return model.displayName;
  const firstPart = model.description.split("·")[0].trim();
  return firstPart.replace(/ with 1M context$/, " [1M]");
}

export function useProviderModels(
  activeProviderId: string,
  variant: "claude" | "copilot" | "codex" | "cursor",
  externalSelectedModel?: string,
  externalOnModelChange?: (model: string) => void,
  workspacePath?: string,
) {
  const dispatch = useAppDispatch();

  const persistedModel = useAppSelector(
    (state) =>
      state.workspace.selectedModelByProvider[activeProviderId],
  );

  const {
    data: providerModels,
    isLoading: isLoadingModels,
    isFetching: isFetchingModels,
    error: modelsError,
    refetch: refetchModels,
  } = useGetProviderModelsQuery(activeProviderId, { skip: !activeProviderId });

  const { data: providerCommands = [], isLoading: isLoadingCommands } =
    useGetProviderCommandsQuery(
      { id: activeProviderId, workspacePath },
      { skip: !activeProviderId },
    );

  const { data: providerSkills = [], isLoading: isLoadingSkills } =
    useGetProviderSkillsQuery(
      { id: activeProviderId, workspacePath },
      { skip: !activeProviderId || (variant !== "claude" && variant !== "codex") },
    );

  const { data: providerData } = useGetProviderByIdQuery(activeProviderId, {
    skip: variant !== "claude" && variant !== "codex" && variant !== "copilot" && variant !== "cursor",
  });
  const [updateProvider] = useUpdateProviderMutation();
  const permissionMode: string = variant === "cursor"
    ? (providerData?.config as any)?.mode ?? "agent"
    : variant === "codex"
      ? (providerData?.config as any)?.sandboxMode ?? "workspace-write"
      : (providerData?.config as any)?.permissionMode ?? "default";
  const thinkingMode = variant === "codex" || variant === "copilot"
    ? !!(providerData?.config as any)?.modelReasoningEffort
    : !!(providerData?.config as any)?.thinkingMode;
  // Codex maps "fast mode" to its "fast" service tier (canonical id from
  // model/list; Codex's request_value forwards it to OpenAI as "priority").
  // Accept both ids so it stays consistent with whatever the Settings dropdown
  // persists, and so legacy installs that stored "priority" still register.
  const fastMode = variant === "codex"
    ? ["fast", "priority"].includes(((providerData?.config as any)?.serviceTier as string) ?? "")
    : !!(providerData?.config as any)?.fastMode;
  const effortLevel: string = variant === "codex" || variant === "copilot"
    ? (providerData?.config as any)?.modelReasoningEffort || ""
    : (providerData?.config as any)?.effortLevel || "";
  const planMode: boolean = variant === "codex"
    ? !!(providerData?.config as any)?.planMode
    : false;

  const handlePermissionModeChange = useCallback(async (mode: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    const configKey = variant === "cursor" ? "mode" : variant === "codex" ? "sandboxMode" : "permissionMode";
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          [configKey]: mode,
        },
      },
    });
  }, [providerData, activeProviderId, variant, updateProvider]);

  const handlePlanModeToggle = useCallback(async () => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          planMode: !planMode,
        },
      },
    });
  }, [providerData, planMode, activeProviderId, updateProvider]);

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
    // For codex, toggle the "fast" service tier on/off (matches the dropdown's
    // canonical id from model/list); non-codex variants keep the simple boolean.
    const patch: Record<string, unknown> = variant === "codex"
      ? { serviceTier: fastMode ? undefined : "fast" }
      : { fastMode: !fastMode };
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          ...patch,
        },
      },
    });
  }, [providerData, fastMode, activeProviderId, updateProvider, variant]);

  const handleEffortLevelChange = useCallback(async (level: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    if (variant === "codex" || variant === "copilot") {
      // Codex/Copilot use modelReasoningEffort in their config
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

  const modelDisplayNames = useMemo(
    () => (providerModels ?? []).map((m) => getModelPrettyName(m, variant)),
    [providerModels, variant],
  );

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
      return model ? getModelPrettyName(model, variant) : selectedModel;
    }
    return "";
  }, [providerModels, selectedModel, variant]);

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

  // Clamp effort level when switching to a model that doesn't support the current level
  useEffect(() => {
    if (!selectedModelInfo) return;
    const supported = selectedModelInfo.supportedEffortLevels;
    if (!supported || supported.length === 0) {
      // Model has no effort levels — clear it
      if (effortLevel) handleEffortLevelChange("");
    } else if (thinkingMode && !effortLevel) {
      // Thinking is on but no effort level set — pick the highest supported
      handleEffortLevelChange(supported[supported.length - 1]);
    } else if (effortLevel && !supported.includes(effortLevel as any)) {
      // Pick the highest supported level as fallback
      handleEffortLevelChange(supported[supported.length - 1]);
    }
  }, [selectedModelInfo, effortLevel, thinkingMode, handleEffortLevelChange]);

  const handleModelChange = useCallback(
    (prettyName: string) => {
      if (providerModels) {
        const model = providerModels.find((m) => getModelPrettyName(m, variant) === prettyName);
        if (model) {
          setSelectedModel(model.id);
          return;
        }
      }
      setSelectedModel(prettyName);
    },
    [providerModels, setSelectedModel, variant],
  );

  return {
    selectedModel,
    selectedModelDisplayName,
    modelDisplayNames,
    isLoadingModels,
    isFetchingModels,
    handleModelChange,
    providerCommands,
    isLoadingCommands,
    providerSkills,
    isLoadingSkills,
    modelsError,
    refetchModels,
    permissionMode,
    handlePermissionModeChange,
    thinkingMode,
    handleThinkingModeToggle,
    fastMode,
    handleFastModeToggle,
    effortLevel,
    handleEffortLevelChange,
    selectedModelInfo,
    planMode,
    handlePlanModeToggle,
  };
}
