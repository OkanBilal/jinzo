import { useEffect, useMemo, useCallback } from "react";
import {
  useGetProviderModelsQuery,
  useGetProviderCommandsQuery,
  useGetProviderSkillsQuery,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api/providersApi";
import { setWorkspaceModel } from "@/lib/redux/slices/workspaceSlice";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { dedupeModelsByPrettyName, getModelPrettyName } from "@/lib/model-icons";

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
  // ultracode is a Claude-only boolean flag (xhigh + dynamic-workflow
  // orchestration). It's the single source of truth; the displayed effort
  // level is folded to "ultracode" so the dropdown shows it as selected.
  const ultracode = variant === "claude" && !!(providerData?.config as any)?.ultracode;
  const effortLevel: string = variant === "codex" || variant === "copilot"
    ? (providerData?.config as any)?.modelReasoningEffort || ""
    : ultracode
      ? "ultracode"
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
    } else if (level === "ultracode") {
      // ultracode is stored as a boolean. It implies xhigh + workflow
      // orchestration, so clear effortLevel and let the driver send it via
      // settings.ultracode instead of options.effort.
      await updateProvider({
        id: activeProviderId,
        payload: {
          config: {
            ...currentConfig,
            thinkingMode: true,
            ultracode: true,
            effortLevel: undefined,
          },
        },
      });
    } else {
      // Claude uses thinkingMode + effortLevel. Any non-ultracode selection
      // (including "Off") turns ultracode back off.
      const enableThinking = !!level;
      await updateProvider({
        id: activeProviderId,
        payload: {
          config: {
            ...currentConfig,
            thinkingMode: enableThinking,
            effortLevel: level || undefined,
            ultracode: false,
          },
        },
      });
    }
  }, [providerData, activeProviderId, updateProvider, variant]);

  const selectableModels = useMemo(
    () => dedupeModelsByPrettyName(providerModels ?? [], variant),
    [providerModels, variant],
  );

  const modelDisplayNames = useMemo(
    () => selectableModels.map((m) => getModelPrettyName(m, variant)),
    [selectableModels, variant],
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

  // Background model-capability discovery (e.g. Cursor per-model effort levels)
  // runs after the initial fast model list returns; refetch to pick up the
  // enriched metadata when the main process signals it's ready.
  useEffect(() => {
    const off = window.api.providers.onModelsUpdated(({ providerId }) => {
      if (providerId === activeProviderId) refetchModels();
    });
    return () => {
      off();
    };
  }, [activeProviderId, refetchModels]);

  // Clamp effort level when switching to a model that doesn't support the current level
  useEffect(() => {
    if (!selectedModelInfo) return;
    const supported = selectedModelInfo.supportedEffortLevels;
    const supportsXhigh = !!supported?.includes("xhigh" as any);

    // ultracode is on but the newly-selected model can't do xhigh — disable it
    // and fall back to the highest supported level (or Off if none). This is
    // what enforces "ultracode must not work on unsupported models".
    if (ultracode && !supportsXhigh) {
      handleEffortLevelChange(
        supported && supported.length > 0 ? supported[supported.length - 1] : "",
      );
      return;
    }
    // ultracode is on and the model still supports xhigh — leave it alone.
    // (Must return before the clamp branches below, otherwise the folded
    // "ultracode" string gets clamped away on every render.)
    if (ultracode) return;

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
  }, [selectedModelInfo, effortLevel, thinkingMode, ultracode, handleEffortLevelChange]);

  const handleModelChange = useCallback(
    (prettyName: string) => {
      const model = selectableModels.find((m) => getModelPrettyName(m, variant) === prettyName);
      if (model) {
        setSelectedModel(model.id);
        return;
      }
      setSelectedModel(prettyName);
    },
    [selectableModels, setSelectedModel, variant],
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
    supportsUltracode:
      variant === "claude" &&
      !!selectedModelInfo?.supportedEffortLevels?.includes("xhigh" as any),
    selectedModelInfo,
    planMode,
    handlePlanModeToggle,
  };
}
