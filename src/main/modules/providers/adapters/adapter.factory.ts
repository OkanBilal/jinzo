// ─────────────────────────────────────────────────────────────
// Work Run Adapter Factory
// Creates appropriate adapter based on provider configuration
// ─────────────────────────────────────────────────────────────

import type { ProviderResponse } from "../providers.dto";
import type { WorkRunAdapter, CopilotAdapterConfig, ClaudeCodeAdapterConfig, ModelInfo, CommandInfo, SkillInfo } from "./adapter.types";
import { createCopilotAdapter } from "./copilot.adapter";
import { createClaudeAdapter } from "./claude.adapter";
import { findCopilotCliPath } from "../providers.utils";

/**
 * Known provider IDs that support work runs
 */
export const SUPPORTED_WORK_PROVIDERS = ["copilot_cli", "claude_code"] as const;
export type SupportedWorkProvider = (typeof SUPPORTED_WORK_PROVIDERS)[number];

/**
 * Check if a provider ID is supported for work runs
 */
export function isSupportedWorkProvider(providerId: string): providerId is SupportedWorkProvider {
  return SUPPORTED_WORK_PROVIDERS.includes(providerId as SupportedWorkProvider);
}

/**
 * Cache of adapter instances by provider ID
 * We reuse adapters to maintain connection state
 */
const adapterCache = new Map<string, WorkRunAdapter>();

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
    case "copilot_cli": {
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
      adapter = createCopilotAdapter(config);
      break;
    }

    case "claude_code": {
      const config: ClaudeCodeAdapterConfig = {
        ...(provider.config as ClaudeCodeAdapterConfig | null),
        defaultModel: provider.defaultModel ?? undefined,
      };
      adapter = createClaudeAdapter(config);
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
export async function listCommandsForProvider(provider: ProviderResponse): Promise<CommandInfo[]> {
  const adapter = createWorkAdapter(provider);

  if (!adapter.listCommands) {
    // Return empty array if provider doesn't support commands
    return [];
  }

  return adapter.listCommands();
}

/**
 * List available skills for a provider
 * Skills are SKILL.md files that extend Claude's capabilities.
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

  if (!adapter.listSkills) {
    // Return empty array if provider doesn't support skills
    return [];
  }

  return adapter.listSkills(workspacePath);
}
