import { ipcMain } from "electron";
import { providersService } from "./providers.service";
import type { CreateProviderPayload, UpdateProviderPayload, ProviderKind } from "./providers.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_ALL: "providers:getAll",
  GET_BY_ID: "providers:getById",
  GET_BY_KIND: "providers:getByKind",
  GET_ENABLED: "providers:getEnabled",
  CREATE: "providers:create",
  UPDATE: "providers:update",
  DELETE: "providers:delete",
  ENABLE: "providers:enable",
  DISABLE: "providers:disable",
  GET_MODELS: "providers:getModels",
  GET_COMMANDS: "providers:getCommands",
  GET_SKILLS: "providers:getSkills",
  GET_RATE_LIMITS: "providers:getRateLimits",
  GET_ACCOUNT_INFO: "providers:getAccountInfo",
  GET_PLUGINS: "providers:getPlugins",
  READ_PLUGIN: "providers:readPlugin",
  INSTALL_PLUGIN: "providers:installPlugin",
  UNINSTALL_PLUGIN: "providers:uninstallPlugin",
  DETECT_INSTALLED: "providers:detectInstalled",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerProvidersIpc(): void {
  ipcMain.handle(CHANNELS.GET_ALL, async () => {
    return providersService.getAll();
  });

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return providersService.getById(id);
  });

  ipcMain.handle(CHANNELS.GET_BY_KIND, async (_, kind: ProviderKind) => {
    return providersService.getByKind(kind);
  });

  ipcMain.handle(CHANNELS.GET_ENABLED, async () => {
    return providersService.getEnabled();
  });

  ipcMain.handle(CHANNELS.CREATE, async (_, payload: CreateProviderPayload) => {
    return providersService.create(payload);
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_, id: string, payload: UpdateProviderPayload) => {
    return providersService.update(id, payload);
  });

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return providersService.delete(id);
  });

  ipcMain.handle(CHANNELS.ENABLE, async (_, id: string) => {
    return providersService.enable(id);
  });

  ipcMain.handle(CHANNELS.DISABLE, async (_, id: string) => {
    return providersService.disable(id);
  });

  ipcMain.handle(CHANNELS.GET_MODELS, async (_, id: string) => {
    return providersService.getModels(id);
  });

  ipcMain.handle(
    CHANNELS.GET_COMMANDS,
    async (_, id: string, workspacePath?: string) => {
      return providersService.getCommands(id, workspacePath);
    },
  );

  ipcMain.handle(CHANNELS.GET_SKILLS, async (_, id: string, workspacePath?: string) => {
    return providersService.getSkills(id, workspacePath);
  });

  ipcMain.handle(CHANNELS.GET_RATE_LIMITS, async (_, id: string) => {
    return providersService.getRateLimits(id);
  });

  ipcMain.handle(CHANNELS.GET_ACCOUNT_INFO, async (_, id: string) => {
    return providersService.getAccountInfo(id);
  });

  ipcMain.handle(CHANNELS.GET_PLUGINS, async (_, id: string) => {
    return providersService.getPlugins(id);
  });

  ipcMain.handle(CHANNELS.READ_PLUGIN, async (_, id: string, pluginName: string, marketplacePath: string) => {
    return providersService.readPlugin(id, pluginName, marketplacePath);
  });

  ipcMain.handle(CHANNELS.INSTALL_PLUGIN, async (_, id: string, pluginId: string) => {
    return providersService.installPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.UNINSTALL_PLUGIN, async (_, id: string, pluginId: string) => {
    return providersService.uninstallPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.DETECT_INSTALLED, async () => {
    return providersService.detectInstalled();
  });
}

export function unregisterProvidersIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
