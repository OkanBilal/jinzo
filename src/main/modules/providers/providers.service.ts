import { providersRepo } from "./providers.repo";
import { detectInstalledClis } from "./providers.utils";
import type {
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderResponse,
  DetectedClisResponse,
} from "./providers.dto";
import { listModelsForProvider, listCommandsForProvider, listSkillsForProvider, getAccountInfoForProvider, updateCliForProvider, listPluginsForProvider, readPluginForProvider, installPluginForProvider, uninstallPluginForProvider, setPluginEnabledForProvider, updatePluginForProvider, getRateLimitsForProvider, setGoalForProvider, getGoalForProvider, clearGoalForProvider, invalidateWorkAdapter, type ModelInfo, type CommandInfo, type SkillInfo, type PluginListResponse, type PluginDetail, type AccountInfo, type CliUpdateResult } from "./adapters";
import type { PluginScope } from "../../../shared/adapter.types";
import type { RateLimitInfo, GoalInfo, GoalSetParams } from "../../../shared/adapter.types";

/** Resolve a provider and require it to be enabled — the shared preamble of
 * every adapter-backed operation. */
async function requireEnabledProvider(id: string): Promise<ProviderResponse> {
  const provider = await providersRepo.findById(id);
  if (!provider) throw new Error("Provider not found");
  if (!provider.isEnabled) throw new Error("Provider is not enabled");
  return provider;
}

// ─────────────────────────────────────────────────────────────
// Providers Service
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// Single-item reads return null for absence (see CONTEXT.md
// "absence rule").
// ─────────────────────────────────────────────────────────────
export const providersService = {
  async getAll(): Promise<ProviderResponse[]> {
    return providersRepo.findAll();
  },

  async getById(id: string): Promise<ProviderResponse | null> {
    return providersRepo.findById(id);
  },

  async getByKind(
    kind: "llm_runtime" | "agent_runtime",
  ): Promise<ProviderResponse[]> {
    return providersRepo.findByKind(kind);
  },

  async getEnabled(): Promise<ProviderResponse[]> {
    return providersRepo.findEnabled();
  },

  async create(payload: CreateProviderPayload): Promise<string> {
    const existing = await providersRepo.findById(payload.id);
    if (existing) {
      throw new Error("Provider with this ID already exists");
    }

    return providersRepo.insert(payload);
  },

  async update(
    id: string,
    payload: UpdateProviderPayload,
  ): Promise<ProviderResponse> {
    const updated = await providersRepo.update(id, payload);
    if (!updated) {
      throw new Error("Provider not found");
    }

    // Invalidate cached adapter so the next run picks up new config
    invalidateWorkAdapter(id);

    return updated;
  },

  async delete(id: string): Promise<void> {
    await providersRepo.delete(id);
  },

  async enable(id: string): Promise<void> {
    await providersRepo.setEnabled(id, true);
  },

  async disable(id: string): Promise<void> {
    await providersRepo.setEnabled(id, false);
  },

  async getModels(id: string): Promise<ModelInfo[]> {
    const provider = await requireEnabledProvider(id);
    return listModelsForProvider(provider);
  },

  async getCommands(
    id: string,
    workspacePath?: string,
  ): Promise<CommandInfo[]> {
    const provider = await requireEnabledProvider(id);
    return listCommandsForProvider(provider, workspacePath);
  },

  async getSkills(id: string, workspacePath?: string): Promise<SkillInfo[]> {
    const provider = await requireEnabledProvider(id);
    return listSkillsForProvider(provider, workspacePath);
  },

  async getRateLimits(id: string): Promise<RateLimitInfo | null> {
    const provider = await requireEnabledProvider(id);
    return getRateLimitsForProvider(provider);
  },

  async setGoal(
    id: string,
    runId: string,
    params: GoalSetParams,
  ): Promise<GoalInfo | null> {
    const provider = await requireEnabledProvider(id);
    return setGoalForProvider(provider, runId, params);
  },

  async getGoal(id: string, runId: string): Promise<GoalInfo | null> {
    const provider = await requireEnabledProvider(id);
    return getGoalForProvider(provider, runId);
  },

  async clearGoal(id: string, runId: string): Promise<boolean> {
    const provider = await requireEnabledProvider(id);
    return clearGoalForProvider(provider, runId);
  },

  async getAccountInfo(id: string): Promise<AccountInfo> {
    const provider = await requireEnabledProvider(id);
    return getAccountInfoForProvider(provider);
  },

  async updateCli(id: string): Promise<CliUpdateResult> {
    const provider = await requireEnabledProvider(id);
    return updateCliForProvider(provider);
  },

  async getPlugins(id: string): Promise<PluginListResponse> {
    const provider = await requireEnabledProvider(id);
    return listPluginsForProvider(provider);
  },

  async readPlugin(
    id: string,
    pluginName: string,
    marketplacePath: string,
  ): Promise<PluginDetail> {
    const provider = await requireEnabledProvider(id);
    return readPluginForProvider(provider, pluginName, marketplacePath);
  },

  async installPlugin(
    id: string,
    pluginId: string,
    scope?: PluginScope,
  ): Promise<void> {
    const provider = await requireEnabledProvider(id);
    await installPluginForProvider(provider, pluginId, scope);
  },

  async uninstallPlugin(id: string, pluginId: string): Promise<void> {
    const provider = await requireEnabledProvider(id);
    await uninstallPluginForProvider(provider, pluginId);
  },

  async setPluginEnabled(
    id: string,
    pluginId: string,
    enabled: boolean,
  ): Promise<void> {
    const provider = await requireEnabledProvider(id);
    await setPluginEnabledForProvider(provider, pluginId, enabled);
  },

  async updatePlugin(id: string, pluginId: string): Promise<void> {
    const provider = await requireEnabledProvider(id);
    await updatePluginForProvider(provider, pluginId);
  },

  async detectInstalled(): Promise<DetectedClisResponse> {
    return detectInstalledClis();
  },
};
