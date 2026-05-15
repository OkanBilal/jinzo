// ─────────────────────────────────────────────────────────────
// Work Run Adapter Factory
// Creates appropriate adapter based on provider configuration
// ─────────────────────────────────────────────────────────────

import type { ProviderResponse } from "../providers.dto";
import type { WorkRunAdapter, CopilotAdapterConfig, ClaudeCodeAdapterConfig, CodexAdapterConfig, CursorAdapterConfig, ModelInfo, CommandInfo, SkillInfo, PluginListResponse, PluginDetail, CodexAccountInfo } from "../../../../shared/adapter.types";
import { createCodexAdapter } from "./codex.adapter";
import { createClaudeDriver } from "./claude.driver";
import { createCopilotDriver } from "./copilot.driver";
import { createCursorDriver } from "./cursor.driver";
import { createWorkRunAdapter } from "./work-run-core";
import { findCopilotCliPath } from "../providers.utils";
import {
  PROVIDER_IDS,
  SUPPORTED_PROVIDER_IDS,
  type ProviderId,
  isProviderId,
} from "../../../../shared/provider-ids";

/**
 * Known provider IDs that support work runs.
 * Re-exported from the canonical provider-ids registry for legacy call sites
 * that still import from this module.
 */
export const SUPPORTED_WORK_PROVIDERS = SUPPORTED_PROVIDER_IDS;
export type SupportedWorkProvider = ProviderId;

export const isSupportedWorkProvider = isProviderId as (
  providerId: string,
) => providerId is SupportedWorkProvider;

/**
 * Cache of adapter instances by provider ID
 * We reuse adapters to maintain connection state
 */
const adapterCache = new Map<string, WorkRunAdapter>();

function pluginListToSkillInfo(pluginList: PluginListResponse): SkillInfo[] {
  const skills: SkillInfo[] = [];

  for (const marketplace of pluginList.marketplaces) {
    for (const plugin of marketplace.plugins) {
      if (!plugin.installed) continue;

      skills.push({
        name: plugin.name,
        description:
          plugin.interface?.shortDescription ||
          plugin.interface?.longDescription ||
          undefined,
        userInvokable: true,
        displayName: plugin.interface?.displayName || plugin.name,
        shortDescription: plugin.interface?.shortDescription,
        iconSmall: plugin.interface?.composerIcon || plugin.interface?.logo,
        iconLarge: plugin.interface?.logo || plugin.interface?.composerIcon,
        brandColor: plugin.interface?.brandColor,
        defaultPrompt: plugin.interface?.defaultPrompt?.[0],
        scope: "plugin",
        enabled: plugin.enabled,
      });
    }
  }

  return skills;
}

function mergeSkillsWithInstalledPlugins(
  skills: SkillInfo[],
  pluginList: PluginListResponse,
): SkillInfo[] {
  const seenNames = new Set(skills.map((skill) => skill.name));
  const pluginSkills = pluginListToSkillInfo(pluginList).filter((pluginSkill) => {
    if (seenNames.has(pluginSkill.name)) return false;
    seenNames.add(pluginSkill.name);
    return true;
  });

  return [...skills, ...pluginSkills];
}

/**
 * Create or retrieve a work run adapter for the given provider
 *
 * @param provider - The provider configuration from the database
 * @returns WorkRunAdapter instance
 * @throws Error if provider is not supported or not enabled
 */
export function createWorkAdapter(provider: ProviderResponse): WorkRunAdapter {
  if (!provider.isEnabled) {
    throw new Error(
      `Provider "${provider.displayName}" (${provider.id}) is not enabled. ` +
        "Please enable it in settings before starting a work run."
    );
  }

  if (provider.kind !== "agent_runtime") {
    throw new Error(
      `Provider "${provider.displayName}" (${provider.id}) is of kind "${provider.kind}". ` +
        "Work runs require an agent_runtime provider."
    );
  }

  // Check cache first
  const cached = adapterCache.get(provider.id);
  if (cached) {
    return cached;
  }

  let adapter: WorkRunAdapter;

  switch (provider.id) {
    case PROVIDER_IDS.copilot: {
      const config: CopilotAdapterConfig = {
        ...(provider.config as CopilotAdapterConfig | null),
        defaultModel: provider.defaultModel ?? undefined,
      };
      // Resolve the Copilot CLI entry point if not explicitly configured.
      // The SDK's internal resolution uses import.meta.resolve() which
      // breaks in bundled CJS / packaged Electron contexts.
      if (!config.binary) {
        const resolvedPath = findCopilotCliPath();
        if (resolvedPath) {
          config.binary = resolvedPath;
        }
      }
      adapter = createWorkRunAdapter(createCopilotDriver(config));
      break;
    }

    case PROVIDER_IDS.claude: {
      const config: ClaudeCodeAdapterConfig = {
        ...(provider.config as ClaudeCodeAdapterConfig | null),
        defaultModel: provider.defaultModel ?? undefined,
      };
      adapter = createWorkRunAdapter(createClaudeDriver(config));
      break;
    }

    case PROVIDER_IDS.codex: {
      const config: CodexAdapterConfig = {
        ...(provider.config as CodexAdapterConfig | null),
        defaultModel: provider.defaultModel ?? undefined,
      };
      adapter = createCodexAdapter(config);
      break;
    }

    case PROVIDER_IDS.cursor: {
      const config: CursorAdapterConfig = {
        ...(provider.config as CursorAdapterConfig | null),
        defaultModel: provider.defaultModel ?? undefined,
      };
      adapter = createWorkRunAdapter(createCursorDriver(config));
      break;
    }

    default:
      throw new Error(
        `Provider "${provider.id}" is not supported for work runs. ` +
          `Supported providers: ${SUPPORTED_WORK_PROVIDERS.join(", ")}`
      );
  }

  // Cache the adapter
  adapterCache.set(provider.id, adapter);

  return adapter;
}

/**
 * Get an existing adapter from cache without creating a new one
 */
export function getWorkAdapter(providerId: string): WorkRunAdapter | undefined {
  return adapterCache.get(providerId);
}

/**
 * Shutdown and remove an adapter from cache
 */
export async function shutdownWorkAdapter(providerId: string): Promise<void> {
  const adapter = adapterCache.get(providerId);
  if (adapter) {
    adapterCache.delete(providerId);
    if (adapter.shutdown) {
      await adapter.shutdown();
    }
  }
}

/**
 * Shutdown all cached adapters
 * Should be called on app quit
 */
export async function shutdownAllWorkAdapters(): Promise<void> {
  const shutdownPromises: Promise<void>[] = [];

  for (const [providerId, adapter] of adapterCache) {
    if (adapter.shutdown) {
      shutdownPromises.push(
        adapter.shutdown().catch((err) => {
          console.error(`[AdapterFactory] Error shutting down ${providerId}:`, err);
        })
      );
    }
  }

  await Promise.all(shutdownPromises);
  adapterCache.clear();
}

/**
 * Clear adapter cache (for testing or reinitialization)
 */
export function clearAdapterCache(): void {
  adapterCache.clear();
}

/**
 * Invalidate a single adapter from cache without shutting it down.
 * Active runs on the old adapter instance continue unaffected;
 * the next call to createWorkAdapter() will build a fresh adapter
 * with the latest provider config.
 */
export function invalidateWorkAdapter(providerId: string): void {
  adapterCache.delete(providerId);
}

/**
 * List available models for a provider
 *
 * @param provider - The provider configuration from the database
 * @returns Promise resolving to array of ModelInfo
 * @throws Error if provider doesn't support model listing
 */
export async function listModelsForProvider(provider: ProviderResponse): Promise<ModelInfo[]> {
  const adapter = createWorkAdapter(provider);

  if (!adapter.listModels) {
    throw new Error(
      `Provider "${provider.displayName}" (${provider.id}) does not support listing models.`
    );
  }

  return adapter.listModels();
}

/**
 * List available commands for a provider
 *
 * @param provider - The provider configuration from the database
 * @returns Promise resolving to array of CommandInfo
 */
export async function listCommandsForProvider(
  provider: ProviderResponse,
  workspacePath?: string,
): Promise<CommandInfo[]> {
  const adapter = createWorkAdapter(provider);

  if (!adapter.listCommands) {
    // Return empty array if provider doesn't support commands
    return [];
  }

  return adapter.listCommands(workspacePath);
}

/**
 * List available skills for a provider
 * Skills are SKILL.md files plus installed provider plugins that can be invoked from the prompt.
 *
 * @param provider - The provider configuration from the database
 * @param workspacePath - Optional workspace path for discovering project skills
 * @returns Promise resolving to array of SkillInfo
 */
export async function listSkillsForProvider(
  provider: ProviderResponse,
  workspacePath?: string,
): Promise<SkillInfo[]> {
  const adapter = createWorkAdapter(provider);

  let skills: SkillInfo[] = [];
  if (!adapter.listSkills) {
    // Return installed plugins only if the provider doesn't support native skills.
    skills = [];
  } else {
    skills = await adapter.listSkills(workspacePath);
  }

  if (!adapter.listPlugins) {
    return skills;
  }

  const plugins = await adapter.listPlugins();
  return mergeSkillsWithInstalledPlugins(skills, plugins);
}

/**
 * Get rate limit info for a provider
 */
export async function getAccountInfoForProvider(provider: ProviderResponse): Promise<CodexAccountInfo> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.getAccountInfo) {
    return { account: null, requiresOpenaiAuth: false };
  }
  return adapter.getAccountInfo();
}

export async function listPluginsForProvider(provider: ProviderResponse): Promise<PluginListResponse> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.listPlugins) {
    return { marketplaces: [], marketplaceLoadErrors: [], remoteSyncError: null, featuredPluginIds: [] };
  }
  return adapter.listPlugins();
}

export async function readPluginForProvider(provider: ProviderResponse, pluginName: string, marketplacePath: string): Promise<PluginDetail> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.readPlugin) {
    throw new Error(`Provider "${provider.displayName}" does not support reading plugin details.`);
  }
  return adapter.readPlugin(pluginName, marketplacePath);
}

export async function installPluginForProvider(provider: ProviderResponse, pluginId: string): Promise<void> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.installPlugin) {
    throw new Error(`Provider "${provider.displayName}" does not support plugin installation.`);
  }
  return adapter.installPlugin(pluginId);
}

export async function uninstallPluginForProvider(provider: ProviderResponse, pluginId: string): Promise<void> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.uninstallPlugin) {
    throw new Error(`Provider "${provider.displayName}" does not support plugin uninstallation.`);
  }
  return adapter.uninstallPlugin(pluginId);
}

export async function getRateLimitsForProvider(
  provider: ProviderResponse,
): Promise<import("../../../../shared/adapter.types").RateLimitInfo | null> {
  const adapter = createWorkAdapter(provider);
  if (!adapter.getRateLimits) return null;
  return adapter.getRateLimits();
}
