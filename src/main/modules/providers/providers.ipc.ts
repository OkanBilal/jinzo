import { ipcMain } from "../../ipc-kit/ipc-main";
import { providersService } from "./providers.service";
import type { CreateProviderPayload, UpdateProviderPayload, ProviderKind } from "./providers.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProvidersIpc(): void {
  ipcMain.handle(CHANNELS.providers.getAll, async () => {
    return providersService.getAll();
  });

  ipcMain.handle(CHANNELS.providers.getById, async (_, id: string) => {
    return providersService.getById(id);
  });

  ipcMain.handle(CHANNELS.providers.getByKind, async (_, kind: ProviderKind) => {
    return providersService.getByKind(kind);
  });

  ipcMain.handle(CHANNELS.providers.getEnabled, async () => {
    return providersService.getEnabled();
  });

  ipcMain.handle(CHANNELS.providers.create, async (_, payload: CreateProviderPayload) => {
    return providersService.create(payload);
  });

  ipcMain.handle(CHANNELS.providers.update, async (_, id: string, payload: UpdateProviderPayload) => {
    return providersService.update(id, payload);
  });

  ipcMain.handle(CHANNELS.providers.delete, async (_, id: string) => {
    return providersService.delete(id);
  });

  ipcMain.handle(CHANNELS.providers.enable, async (_, id: string) => {
    return providersService.enable(id);
  });

  ipcMain.handle(CHANNELS.providers.disable, async (_, id: string) => {
    return providersService.disable(id);
  });

  ipcMain.handle(CHANNELS.providers.getModels, async (_, id: string) => {
    return providersService.getModels(id);
  });

  ipcMain.handle(
    CHANNELS.providers.getCommands,
    async (_, id: string, workspacePath?: string) => {
      return providersService.getCommands(id, workspacePath);
    },
  );

  ipcMain.handle(CHANNELS.providers.getSkills, async (_, id: string, workspacePath?: string) => {
    return providersService.getSkills(id, workspacePath);
  });

  ipcMain.handle(CHANNELS.providers.getRateLimits, async (_, id: string) => {
    return providersService.getRateLimits(id);
  });

  ipcMain.handle(CHANNELS.providers.setGoal, async (_, id: string, runId: string, params: import("../../../shared/adapter.types").GoalSetParams) => {
    return providersService.setGoal(id, runId, params);
  });

  ipcMain.handle(CHANNELS.providers.getGoal, async (_, id: string, runId: string) => {
    return providersService.getGoal(id, runId);
  });

  ipcMain.handle(CHANNELS.providers.clearGoal, async (_, id: string, runId: string) => {
    return providersService.clearGoal(id, runId);
  });

  ipcMain.handle(CHANNELS.providers.getAccountInfo, async (_, id: string) => {
    return providersService.getAccountInfo(id);
  });

  ipcMain.handle(CHANNELS.providers.updateCli, async (_, id: string) => {
    return providersService.updateCli(id);
  });

  ipcMain.handle(CHANNELS.providers.getPlugins, async (_, id: string) => {
    return providersService.getPlugins(id);
  });

  ipcMain.handle(CHANNELS.providers.readPlugin, async (_, id: string, pluginName: string, marketplacePath: string) => {
    return providersService.readPlugin(id, pluginName, marketplacePath);
  });

  ipcMain.handle(CHANNELS.providers.installPlugin, async (_, id: string, pluginId: string) => {
    return providersService.installPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.providers.uninstallPlugin, async (_, id: string, pluginId: string) => {
    return providersService.uninstallPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.providers.detectInstalled, async () => {
    return providersService.detectInstalled();
  });
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
    CHANNELS.providers.readPlugin,
    CHANNELS.providers.installPlugin,
    CHANNELS.providers.uninstallPlugin,
    CHANNELS.providers.detectInstalled,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
