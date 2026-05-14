import { ipcMain } from "electron";
import { providersController } from "./providers.controller";
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
    return providersController.getAll();
  });

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return providersController.getById(id);
  });

  ipcMain.handle(CHANNELS.GET_BY_KIND, async (_, kind: ProviderKind) => {
    return providersController.getByKind(kind);
  });

  ipcMain.handle(CHANNELS.GET_ENABLED, async () => {
    return providersController.getEnabled();
  });

  ipcMain.handle(CHANNELS.CREATE, async (_, payload: CreateProviderPayload) => {
    return providersController.create(payload);
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_, id: string, payload: UpdateProviderPayload) => {
    return providersController.update(id, payload);
  });

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return providersController.delete(id);
  });

  ipcMain.handle(CHANNELS.ENABLE, async (_, id: string) => {
    return providersController.enable(id);
  });

  ipcMain.handle(CHANNELS.DISABLE, async (_, id: string) => {
    return providersController.disable(id);
  });

  ipcMain.handle(CHANNELS.GET_MODELS, async (_, id: string) => {
    return providersController.getModels(id);
  });

  ipcMain.handle(
    CHANNELS.GET_COMMANDS,
    async (_, id: string, workspacePath?: string) => {
      return providersController.getCommands(id, workspacePath);
    },
  );

  ipcMain.handle(CHANNELS.GET_SKILLS, async (_, id: string, workspacePath?: string) => {
    return providersController.getSkills(id, workspacePath);
  });

  ipcMain.handle(CHANNELS.GET_RATE_LIMITS, async (_, id: string) => {
    return providersController.getRateLimits(id);
  });

  ipcMain.handle(CHANNELS.GET_ACCOUNT_INFO, async (_, id: string) => {
    return providersController.getAccountInfo(id);
  });

  ipcMain.handle(CHANNELS.GET_PLUGINS, async (_, id: string) => {
    return providersController.getPlugins(id);
  });

  ipcMain.handle(CHANNELS.READ_PLUGIN, async (_, id: string, pluginName: string, marketplacePath: string) => {
    return providersController.readPlugin(id, pluginName, marketplacePath);
  });

  ipcMain.handle(CHANNELS.INSTALL_PLUGIN, async (_, id: string, pluginId: string) => {
    return providersController.installPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.UNINSTALL_PLUGIN, async (_, id: string, pluginId: string) => {
    return providersController.uninstallPlugin(id, pluginId);
  });

  ipcMain.handle(CHANNELS.DETECT_INSTALLED, async () => {
    return providersController.detectInstalled();
  });
}

export function unregisterProvidersIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
