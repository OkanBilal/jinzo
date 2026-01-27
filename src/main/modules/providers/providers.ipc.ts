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
}

export function unregisterProvidersIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
