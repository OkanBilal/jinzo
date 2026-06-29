import { useEffect, useMemo, useCallback } from "react";
import { appEvents } from "@/lib/transport";
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
import { getProviderVariant, type ProviderVariant } from "../lib/provider-variants";

export function useProviderModels(
  activeProviderId: string,
  variant: ProviderVariant,
  externalSelectedModel?: string,
  externalOnModelChange?: (model: string) => void,
  workspacePath?: string,
) {
  const dispatch = useAppDispatch();
  const caps = getProviderVariant(variant);

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
      { skip: !activeProviderId || !caps.supportsSkills },
    );

  const { data: providerData } = useGetProviderByIdQuery(activeProviderId, {
    skip: variant !== "claude" && variant !== "codex" && variant !== "copilot" && variant !== "cursor",
  });
  const [updateProvider] = useUpdateProviderMutation();
  const config = (providerData?.config ?? {}) as Record<string, any>;

  const permissionMode: string = config[caps.permissionKey] ?? caps.permissionDefault;
  const thinkingMode = caps.thinkingCoupledToEffort
    ? !!config.modelReasoningEffort
    : !!config.thinkingMode;
  // Codex maps "fast mode" to its "fast" service tier (canonical id from
  // model/list; Codex's request_value forwards it to OpenAI as "priority").
  // Accept both ids so it stays consistent with whatever the Settings dropdown
  // persists, and so legacy installs that stored "priority" still register.
  const fastMode = caps.fastMode.kind === "serviceTier"
    ? caps.fastMode.match.includes((config[caps.fastMode.key] as string) ?? "")
    : !!config[caps.fastMode.key];
  // ultracode is a Claude-only boolean flag (xhigh + dynamic-workflow
  // orchestration). It's the single source of truth; the displayed effort
  // level is folded to "ultracode" so the dropdown shows it as selected.
  const ultracode = caps.supportsUltracode && !!config.ultracode;
  const effortLevel: string = !caps.thinkingCoupledToEffort && ultracode
    ? "ultracode"
    : config[caps.effortKey] || "";
  const planMode: boolean = caps.supportsPlanMode && !!config.planMode;
  const goalMode: boolean = caps.supportsGoalMode && !!config.goalMode;

  const handlePermissionModeChange = useCallback(async (mode: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    const configKey = caps.permissionKey;
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          [configKey]: mode,
        },
      },
    });
  }, [providerData, activeProviderId, caps, updateProvider]);

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

  const handleGoalModeToggle = useCallback(async () => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    const enabling = !goalMode;
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          goalMode: !goalMode,
          // Goal and plan modes are mutually exclusive — turning goal on clears plan.
          ...(enabling ? { planMode: false } : {}),
        },
      },
    });
  }, [providerData, goalMode, activeProviderId, updateProvider]);

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
    // Codex toggles the "fast" service tier on/off (canonical id from
    // model/list); other variants keep the simple boolean.
    const patch: Record<string, unknown> = caps.fastMode.kind === "serviceTier"
      ? { [caps.fastMode.key]: fastMode ? undefined : caps.fastMode.on }
      : { [caps.fastMode.key]: !fastMode };
    await updateProvider({
      id: activeProviderId,
      payload: {
        config: {
          ...currentConfig,
          ...patch,
        },
      },
    });
  }, [providerData, fastMode, activeProviderId, updateProvider, caps]);

  const handleEffortLevelChange = useCallback(async (level: string) => {
    if (!providerData) return;
    const currentConfig = providerData.config ?? {};
    let patch: Record<string, unknown>;
    if (caps.thinkingCoupledToEffort) {
      // Codex/Copilot store the effort directly; thinking is inferred from it.
      patch = { [caps.effortKey]: level || undefined };
    } else if (caps.supportsUltracode && level === "ultracode") {
      // ultracode is stored as a boolean. It implies xhigh + workflow
      // orchestration, so clear effortLevel and let the driver send it via
      // settings.ultracode instead of options.effort.
      patch = { thinkingMode: true, ultracode: true, effortLevel: undefined };
    } else {
      // Claude/Cursor use thinkingMode + effortLevel. Any non-ultracode
      // selection (including "Off") turns ultracode back off.
      patch = { thinkingMode: !!level, effortLevel: level || undefined, ultracode: false };
    }
    await updateProvider({
      id: activeProviderId,
      payload: { config: { ...currentConfig, ...patch } },
    });
  }, [providerData, activeProviderId, updateProvider, caps]);

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
    const off = appEvents.providers.onModelsUpdated(({ providerId }) => {
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
      caps.supportsUltracode &&
      !!selectedModelInfo?.supportedEffortLevels?.includes("xhigh" as any),
    selectedModelInfo,
    planMode,
    handlePlanModeToggle,
    goalMode,
    handleGoalModeToggle,
  };
}
