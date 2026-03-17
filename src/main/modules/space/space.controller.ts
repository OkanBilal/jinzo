import { spaceService } from "./space.service";

// ─────────────────────────────────────────────────────────────
// Space Controller - Maps IPC calls to service methods
// ─────────────────────────────────────────────────────────────
export const spaceController = {
  async getAll() {
    return spaceService.getAll();
  },

  async getById(spaceId: string) {
    return spaceService.getById(spaceId);
  },

  async create(payload: unknown) {
    return spaceService.create(payload);
  },

  async update(spaceId: string, payload: unknown) {
    return spaceService.update(spaceId, payload);
  },

  async delete(spaceId: string) {
    return spaceService.delete(spaceId);
  },

  async archive(spaceId: string) {
    return spaceService.archive(spaceId);
  },

  async unarchive(spaceId: string) {
    return spaceService.unarchive(spaceId);
  },
};
