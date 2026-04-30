import { providersRepo } from "./providers.repo";
import type {
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderResponse,
  ServiceResponse,
} from "./providers.dto";
import { listModelsForProvider, listCommandsForProvider, listSkillsForProvider, getAccountInfoForProvider, listPluginsForProvider, readPluginForProvider, installPluginForProvider, uninstallPluginForProvider, getRateLimitsForProvider, invalidateWorkAdapter, type ModelInfo, type CommandInfo, type SkillInfo, type PluginListResponse, type PluginDetail, type CodexAccountInfo } from "./adapters";
import type { RateLimitInfo } from "./adapters/adapter.types";

// ─────────────────────────────────────────────────────────────
// Providers Service
// ─────────────────────────────────────────────────────────────
export const providersService = {
  async getAll(): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findAll();
      return { success: true, data: providers };
    } catch (error) {
      console.error("[ProvidersService] Failed to get all providers:", error);
      return { success: false, error: "Failed to get providers" };
    }
  },

  async getById(id: string): Promise<ServiceResponse<ProviderResponse>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return { success: false, error: "Provider not found" };
      }
      return { success: true, data: provider };
    } catch (error) {
      console.error(`[ProvidersService] Failed to get provider ${id}:`, error);
      return { success: false, error: "Failed to get provider" };
    }
  },

  async getByKind(kind: "llm_runtime" | "agent_runtime"): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findByKind(kind);
      return { success: true, data: providers };
    } catch (error) {
      console.error(`[ProvidersService] Failed to get providers by kind ${kind}:`, error);
      return { success: false, error: "Failed to get providers" };
    }
  },

  async getEnabled(): Promise<ServiceResponse<ProviderResponse[]>> {
    try {
      const providers = await providersRepo.findEnabled();
      return { success: true, data: providers };
    } catch (error) {
      console.error("[ProvidersService] Failed to get enabled providers:", error);
      return { success: false, error: "Failed to get providers" };
    }
  },

  async create(payload: CreateProviderPayload): Promise<ServiceResponse<string>> {
    try {
      // Check if provider already exists
      const existing = await providersRepo.findById(payload.id);
      if (existing) {
        return { success: false, error: "Provider with this ID already exists" };
      }

      const id = await providersRepo.insert(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[ProvidersService] Failed to create provider:", error);
      return { success: false, error: "Failed to create provider" };
    }
  },

  async update(id: string, payload: UpdateProviderPayload): Promise<ServiceResponse<ProviderResponse>> {
    try {
      const updated = await providersRepo.update(id, payload);
      if (!updated) {
        return { success: false, error: "Provider not found" };
      }

      // Invalidate cached adapter so the next run picks up new config
      invalidateWorkAdapter(id);

      return { success: true, data: updated };
    } catch (error) {
      console.error(`[ProvidersService] Failed to update provider ${id}:`, error);
      return { success: false, error: "Failed to update provider" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.delete(id);
      return { success: true };
    } catch (error) {
      console.error(`[ProvidersService] Failed to delete provider ${id}:`, error);
      return { success: false, error: "Failed to delete provider" };
    }
  },

  async enable(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.setEnabled(id, true);
      return { success: true };
    } catch (error) {
      console.error(`[ProvidersService] Failed to enable provider ${id}:`, error);
      return { success: false, error: "Failed to enable provider" };
    }
  },

  async disable(id: string): Promise<ServiceResponse<void>> {
    try {
      await providersRepo.setEnabled(id, false);
      return { success: true };
    } catch (error) {
      console.error(`[ProvidersService] Failed to disable provider ${id}:`, error);
      return { success: false, error: "Failed to disable provider" };
    }
  },

  async getModels(id: string): Promise<ServiceResponse<ModelInfo[]>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) {
        return { success: false, error: "Provider not found" };
      }

      if (!provider.isEnabled) {
        return { success: false, error: "Provider is not enabled" };
      }

      const models = await listModelsForProvider(provider);
      return { success: true, data: models };
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
        return { success: false, error: "Provider not found" };
      }

      if (!provider.isEnabled) {
        return { success: false, error: "Provider is not enabled" };
      }

      const commands = await listCommandsForProvider(provider, workspacePath);
      return { success: true, data: commands };
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
        return { success: false, error: "Provider not found" };
      }

      if (!provider.isEnabled) {
        return { success: false, error: "Provider is not enabled" };
      }

      const skills = await listSkillsForProvider(provider, workspacePath);
      return { success: true, data: skills };
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
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };

      const rateLimits = await getRateLimitsForProvider(provider);
      return { success: true, data: rateLimits };
    } catch (error) {
      console.error(`[ProvidersService] Failed to get rate limits for provider ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get rate limits",
      };
    }
  },

  async getAccountInfo(id: string): Promise<ServiceResponse<CodexAccountInfo>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };
      const info = await getAccountInfoForProvider(provider);
      return { success: true, data: info };
    } catch (error) {
      console.error(`[ProvidersService] Failed to get account info for ${id}:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to get account info" };
    }
  },

  async getPlugins(id: string): Promise<ServiceResponse<PluginListResponse>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };
      const plugins = await listPluginsForProvider(provider);
      return { success: true, data: plugins };
    } catch (error) {
      console.error(`[ProvidersService] Failed to get plugins for provider ${id}:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to get plugins" };
    }
  },

  async readPlugin(id: string, pluginName: string, marketplacePath: string): Promise<ServiceResponse<PluginDetail>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };
      const detail = await readPluginForProvider(provider, pluginName, marketplacePath);
      return { success: true, data: detail };
    } catch (error) {
      console.error(`[ProvidersService] Failed to read plugin ${pluginName}:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to read plugin" };
    }
  },

  async installPlugin(id: string, pluginId: string): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };
      await installPluginForProvider(provider, pluginId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`[ProvidersService] Failed to install plugin ${pluginId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to install plugin" };
    }
  },

  async uninstallPlugin(id: string, pluginId: string): Promise<ServiceResponse<void>> {
    try {
      const provider = await providersRepo.findById(id);
      if (!provider) return { success: false, error: "Provider not found" };
      if (!provider.isEnabled) return { success: false, error: "Provider is not enabled" };
      await uninstallPluginForProvider(provider, pluginId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error(`[ProvidersService] Failed to uninstall plugin ${pluginId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to uninstall plugin" };
    }
  },
};
