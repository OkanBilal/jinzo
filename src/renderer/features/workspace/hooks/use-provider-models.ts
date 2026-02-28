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
  variant: "claude" | "copilot",
  externalSelectedModel?: string,
  externalOnModelChange?: (model: string) => void,
  workspacePath?: string,
) {
  const dispatch = useDispatch();

  const persistedModel = useSelector(
    (state: RootState) =>
      state.workspace.selectedModelByProvider[activeProviderId],
  );

  const { data: providerModels, isLoading: isLoadingModels } =
    useGetProviderModelsQuery(activeProviderId, { skip: !activeProviderId });

  const { data: providerCommands = [], isLoading: isLoadingCommands } =
    useGetProviderCommandsQuery(activeProviderId, { skip: !activeProviderId });

  const { data: providerSkills = [], isLoading: isLoadingSkills } =
    useGetProviderSkillsQuery(
      { id: activeProviderId, workspacePath },
      { skip: !activeProviderId || variant !== "claude" },
    );

  const { data: providerData } = useGetProviderByIdQuery(activeProviderId, {
    skip: variant !== "claude",
  });
  const [updateProvider] = useUpdateProviderMutation();
  const planMode = !!(providerData?.config as any)?.planMode;
  const thinkingMode = !!(providerData?.config as any)?.thinkingMode;

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
    planMode,
    handlePlanModeToggle,
    thinkingMode,
    handleThinkingModeToggle,
  };
}
