import { moodService } from "./mood.service";

// ─────────────────────────────────────────────────────────────
// Mood Controller - Maps IPC calls to service methods
// ─────────────────────────────────────────────────────────────
export const moodController = {
  async getAll() {
    return moodService.getAll();
  },

  async getById(moodId: string) {
    return moodService.getById(moodId);
  },

  async create(payload: unknown) {
    return moodService.create(payload);
  },

  async update(moodId: string, payload: unknown) {
    return moodService.update(moodId, payload);
  },

  async delete(moodId: string) {
    return moodService.delete(moodId);
  },

  async archive(moodId: string) {
    return moodService.archive(moodId);
  },
};
