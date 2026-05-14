import { providersService } from "./providers.service";
import type {
  CreateProviderPayload,
  UpdateProviderPayload,
  ProviderKind,
} from "./providers.dto";

// ─────────────────────────────────────────────────────────────
// Providers Controller
// ─────────────────────────────────────────────────────────────
export const providersController = {
  async getAll() {
    return providersService.getAll();
  },

  async getById(id: string) {
    return providersService.getById(id);
  },

  async getByKind(kind: ProviderKind) {
    return providersService.getByKind(kind);
  },

  async getEnabled() {
    return providersService.getEnabled();
  },

  async create(payload: CreateProviderPayload) {
    return providersService.create(payload);
  },

  async update(id: string, payload: UpdateProviderPayload) {
    return providersService.update(id, payload);
  },

  async delete(id: string) {
    return providersService.delete(id);
  },

  async enable(id: string) {
    return providersService.enable(id);
  },

  async disable(id: string) {
    return providersService.disable(id);
  },

  async getModels(id: string) {
    return providersService.getModels(id);
  },

  async getCommands(id: string, workspacePath?: string) {
    return providersService.getCommands(id, workspacePath);
  },

  async getSkills(id: string, workspacePath?: string) {
    return providersService.getSkills(id, workspacePath);
  },

  async getRateLimits(id: string) {
    return providersService.getRateLimits(id);
  },

  async getAccountInfo(id: string) {
    return providersService.getAccountInfo(id);
  },

  async getPlugins(id: string) {
    return providersService.getPlugins(id);
  },

  async readPlugin(id: string, pluginName: string, marketplacePath: string) {
    return providersService.readPlugin(id, pluginName, marketplacePath);
  },

  async installPlugin(id: string, pluginId: string) {
    return providersService.installPlugin(id, pluginId);
  },

  async uninstallPlugin(id: string, pluginId: string) {
    return providersService.uninstallPlugin(id, pluginId);
  },

  async detectInstalled() {
    return providersService.detectInstalled();
  },
};
