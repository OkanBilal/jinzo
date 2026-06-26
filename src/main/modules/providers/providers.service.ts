import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { providersRepo } from "./providers.repo";
import { detectInstalledClis } from "./providers.utils";
import type {
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderResponse,
  ServiceResponse,
  DetectedClisResponse,
} from "./providers.dto";
import { listModelsForProvider, listCommandsForProvider, listSkillsForProvider, getAccountInfoForProvider, updateCliForProvider, listPluginsForProvider, readPluginForProvider, installPluginForProvider, uninstallPluginForProvider, setPluginEnabledForProvider, updatePluginForProvider, getRateLimitsForProvider, setGoalForProvider, getGoalForProvider, clearGoalForProvider, invalidateWorkAdapter, type ModelInfo, type CommandInfo, type SkillInfo, type PluginListResponse, type PluginDetail, type AccountInfo, type CliUpdateResult } from "./adapters";
import type { PluginScope } from "../../../shared/adapter.types";
import type { RateLimitInfo, GoalInfo, GoalSetParams } from "../../../shared/adapter.types";

// ─────────────────────────────────────────────────────────────
// Providers Service
// ─────────────────────────────────────────────────────────────
export const providersService = {
  async getAll(): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findAll();
      return ok(providers);
    } catch (error) {
      console.error("[ProvidersService] Failed to get all providers:", error);
      return fail("Failed to get providers");
    }
  },

  async getById(id: string): Promise<ServiceResponse<ProviderResponse>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return fail("Provider not found");
      }
      return ok(provider);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get provider ${id}:`, error);
      return fail("Failed to get provider");
    }
  },

  async getByKind(kind: "llm_runtime" | "agent_runtime"): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findByKind(kind);
      return ok(providers);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get providers by kind ${kind}:`, error);
      return fail("Failed to get providers");
    }
  },

  async getEnabled(): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findEnabled();
      return ok(providers);
    } catch (error) {
      console.error("[ProvidersService] Failed to get enabled providers:", error);
      return fail("Failed to get providers");
    }
  },

  async create(payload: CreateProviderPayload): Promise<ServiceResponse<string>> {
    try {
      // Check if provider already exists
      const existing = await providersRepo.findById(payload.id);
      if (existing) {
        return fail("Provider with this ID already exists");
      }

      const id = await providersRepo.insert(payload);
      return ok(id);
    } catch (error) {
      console.error("[ProvidersService] Failed to create provider:", error);
      return fail("Failed to create provider");
    }
  },

  async update(id: string, payload: UpdateProviderPayload): Promise<ServiceResponse<ProviderResponse>> {
    try {
      const updated = await providersRepo.update(id, payload);
      if (!updated) {
        return fail("Provider not found");
      }

      // Invalidate cached adapter so the next run picks up new config
      invalidateWorkAdapter(id);

      return ok(updated);
    } catch (error) {
      console.error(`[ProvidersService] Failed to update provider ${id}:`, error);
      return fail("Failed to update provider");
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.delete(id);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to delete provider ${id}:`, error);
      return fail("Failed to delete provider");
    }
  },

  async enable(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.setEnabled(id, true);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to enable provider ${id}:`, error);
      return fail("Failed to enable provider");
    }
  },

  async disable(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.setEnabled(id, false);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to disable provider ${id}:`, error);
      return fail("Failed to disable provider");
    }
  },

  async getModels(id: string): Promise<ServiceResponse<ModelInfo[]>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return fail("Provider not found");
      }

      if (!provider.isEnabled) {
        return fail("Provider is not enabled");
      }

      const models = await listModelsForProvider(provider);
      return ok(models);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get models for provider ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get models"
      };
    }
  },

  async getCommands(
    id: string,
    workspacePath?: string,
  ): Promise<ServiceResponse<CommandInfo[]>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return fail("Provider not found");
      }

      if (!provider.isEnabled) {
        return fail("Provider is not enabled");
      }

      const commands = await listCommandsForProvider(provider, workspacePath);
      return ok(commands);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get commands for provider ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get commands"
      };
    }
  },

  async getSkills(id: string, workspacePath?: string): Promise<ServiceResponse<SkillInfo[]>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return fail("Provider not found");
      }

      if (!provider.isEnabled) {
        return fail("Provider is not enabled");
      }

      const skills = await listSkillsForProvider(provider, workspacePath);
      return ok(skills);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get skills for provider ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get skills"
      };
    }
  },

  async getRateLimits(id: string): Promise<ServiceResponse<RateLimitInfo | null>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");

      const rateLimits = await getRateLimitsForProvider(provider);
      return ok(rateLimits);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get rate limits for provider ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get rate limits",
      };
    }
  },

  async setGoal(id: string, runId: string, params: GoalSetParams): Promise<ServiceResponse<GoalInfo | null>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const goal = await setGoalForProvider(provider, runId, params);
      return ok(goal);
    } catch (error) {
      console.error(`[ProvidersService] Failed to set goal for provider ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to set goal");
    }
  },

  async getGoal(id: string, runId: string): Promise<ServiceResponse<GoalInfo | null>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const goal = await getGoalForProvider(provider, runId);
      return ok(goal);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get goal for provider ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to get goal");
    }
  },

  async clearGoal(id: string, runId: string): Promise<ServiceResponse<boolean>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const cleared = await clearGoalForProvider(provider, runId);
      return ok(cleared);
    } catch (error) {
      console.error(`[ProvidersService] Failed to clear goal for provider ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to clear goal");
    }
  },

  async getAccountInfo(id: string): Promise<ServiceResponse<AccountInfo>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const info = await getAccountInfoForProvider(provider);
      return ok(info);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get account info for ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to get account info");
    }
  },

  async updateCli(id: string): Promise<ServiceResponse<CliUpdateResult>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const result = await updateCliForProvider(provider);
      return ok(result);
    } catch (error) {
      console.error(`[ProvidersService] Failed to update CLI for ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to update CLI");
    }
  },

  async getPlugins(id: string): Promise<ServiceResponse<PluginListResponse>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const plugins = await listPluginsForProvider(provider);
      return ok(plugins);
    } catch (error) {
      console.error(`[ProvidersService] Failed to get plugins for provider ${id}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to get plugins");
    }
  },

  async readPlugin(id: string, pluginName: string, marketplacePath: string): Promise<ServiceResponse<PluginDetail>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      const detail = await readPluginForProvider(provider, pluginName, marketplacePath);
      return ok(detail);
    } catch (error) {
      console.error(`[ProvidersService] Failed to read plugin ${pluginName}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to read plugin");
    }
  },

  async installPlugin(id: string, pluginId: string, scope?: PluginScope): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      await installPluginForProvider(provider, pluginId, scope);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to install plugin ${pluginId}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to install plugin");
    }
  },

  async uninstallPlugin(id: string, pluginId: string): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      await uninstallPluginForProvider(provider, pluginId);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to uninstall plugin ${pluginId}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to uninstall plugin");
    }
  },

  async setPluginEnabled(id: string, pluginId: string, enabled: boolean): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      await setPluginEnabledForProvider(provider, pluginId, enabled);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to toggle plugin ${pluginId}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to toggle plugin");
    }
  },

  async updatePlugin(id: string, pluginId: string): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return fail("Provider not found");
      if (!provider.isEnabled) return fail("Provider is not enabled");
      await updatePluginForProvider(provider, pluginId);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProvidersService] Failed to update plugin ${pluginId}:`, error);
      return fail(error instanceof Error ? error.message : "Failed to update plugin");
    }
  },

  async detectInstalled(): Promise<ServiceResponse<DetectedClisResponse>> {
    try {
      return ok(detectInstalledClis());
    } catch (error) {
      console.error("[ProvidersService] Failed to detect installed CLIs:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect installed CLIs",
      };
    }
  },
};
