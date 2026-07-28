import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit/handle";
import { providersService } from "./providers.service";
import type { CreateProviderPayload, UpdateProviderPayload, ProviderKind } from "./providers.dto";
import type { PluginScope } from "../../../shared/adapter.types";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProvidersIpc(): void {
  ipcMain.handle(
    CHANNELS.providers.getAll,
    handle(() => providersService.getAll()),
  );

  ipcMain.handle(
    CHANNELS.providers.getById,
    handle((id: string) => providersService.getById(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.getByKind,
    handle((kind: ProviderKind) => providersService.getByKind(kind)),
  );

  ipcMain.handle(
    CHANNELS.providers.getEnabled,
    handle(() => providersService.getEnabled()),
  );

  ipcMain.handle(
    CHANNELS.providers.create,
    handle((payload: CreateProviderPayload) => providersService.create(payload)),
  );

  ipcMain.handle(
    CHANNELS.providers.update,
    handle((id: string, payload: UpdateProviderPayload) => providersService.update(id, payload)),
  );

  ipcMain.handle(
    CHANNELS.providers.delete,
    handle((id: string) => providersService.delete(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.enable,
    handle((id: string) => providersService.enable(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.disable,
    handle((id: string) => providersService.disable(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.getModels,
    handle((id: string) => providersService.getModels(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.getCommands,
    handle((id: string, workspacePath?: string) => providersService.getCommands(id, workspacePath)),
  );

  ipcMain.handle(
    CHANNELS.providers.getSkills,
    handle((id: string, workspacePath?: string) => providersService.getSkills(id, workspacePath)),
  );

  ipcMain.handle(
    CHANNELS.providers.getRateLimits,
    handle((id: string) => providersService.getRateLimits(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.setGoal,
    handle((id: string, runId: string, params: import("../../../shared/adapter.types").GoalSetParams) => providersService.setGoal(id, runId, params)),
  );

  ipcMain.handle(
    CHANNELS.providers.getGoal,
    handle((id: string, runId: string) => providersService.getGoal(id, runId)),
  );

  ipcMain.handle(
    CHANNELS.providers.clearGoal,
    handle((id: string, runId: string) => providersService.clearGoal(id, runId)),
  );

  ipcMain.handle(
    CHANNELS.providers.getAccountInfo,
    handle((id: string) => providersService.getAccountInfo(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.updateCli,
    handle((id: string) => providersService.updateCli(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.getPlugins,
    handle((id: string) => providersService.getPlugins(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.getInstalledPlugins,
    handle((id: string) => providersService.getInstalledPlugins(id)),
  );

  ipcMain.handle(
    CHANNELS.providers.readPlugin,
    handle((id: string, pluginName: string, marketplacePath: string) => providersService.readPlugin(id, pluginName, marketplacePath)),
  );

  ipcMain.handle(
    CHANNELS.providers.installPlugin,
    handle((id: string, pluginId: string, scope?: PluginScope) => providersService.installPlugin(id, pluginId, scope)),
  );

  ipcMain.handle(
    CHANNELS.providers.uninstallPlugin,
    handle((id: string, pluginId: string) => providersService.uninstallPlugin(id, pluginId)),
  );

  ipcMain.handle(
    CHANNELS.providers.setPluginEnabled,
    handle((id: string, pluginId: string, enabled: boolean) => providersService.setPluginEnabled(id, pluginId, enabled)),
  );

  ipcMain.handle(
    CHANNELS.providers.updatePlugin,
    handle((id: string, pluginId: string) => providersService.updatePlugin(id, pluginId)),
  );

  ipcMain.handle(
    CHANNELS.providers.detectInstalled,
    handle(() => providersService.detectInstalled()),
  );
}

export function unregisterProvidersIpc(): void {
  [
    CHANNELS.providers.getAll,
    CHANNELS.providers.getById,
    CHANNELS.providers.getByKind,
    CHANNELS.providers.getEnabled,
    CHANNELS.providers.create,
    CHANNELS.providers.update,
    CHANNELS.providers.delete,
    CHANNELS.providers.enable,
    CHANNELS.providers.disable,
    CHANNELS.providers.getModels,
    CHANNELS.providers.getCommands,
    CHANNELS.providers.getSkills,
    CHANNELS.providers.getRateLimits,
    CHANNELS.providers.setGoal,
    CHANNELS.providers.getGoal,
    CHANNELS.providers.clearGoal,
    CHANNELS.providers.getAccountInfo,
    CHANNELS.providers.updateCli,
    CHANNELS.providers.getPlugins,
    CHANNELS.providers.getInstalledPlugins,
    CHANNELS.providers.readPlugin,
    CHANNELS.providers.installPlugin,
    CHANNELS.providers.uninstallPlugin,
    CHANNELS.providers.setPluginEnabled,
    CHANNELS.providers.updatePlugin,
    CHANNELS.providers.detectInstalled,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
