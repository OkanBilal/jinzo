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
};
