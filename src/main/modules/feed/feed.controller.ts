import { feedService } from "./feed.service";
import type { FeedQueryOptions } from "./feed.dto";

// ─────────────────────────────────────────────────────────────
// Feed Controller - Maps IPC calls to service methods
// ─────────────────────────────────────────────────────────────
export const feedController = {
  async getEvents(options: FeedQueryOptions = {}) {
    return feedService.getEvents(options);
  },

  async getEventById(id: number) {
    return feedService.getEventById(id);
  },

  async getEventsByEntity(entityId: string) {
    return feedService.getEventsByEntity(entityId);
  },
};
