import { feedRepo } from "./feed.repo";
import { parseQueryParams, buildWhereClause } from "./feed.utils";
import type { FeedQueryOptions, FeedItemRecord, ServiceResponse } from "./feed.dto";

// ─────────────────────────────────────────────────────────────
// Feed Service
// ─────────────────────────────────────────────────────────────
export const feedService = {
  async getEvents(options: FeedQueryOptions = {}): Promise<ServiceResponse<FeedItemRecord[]>> {
    try {
      const params = parseQueryParams(options);
      const whereClause = buildWhereClause(params);
      const items = await feedRepo.findMany(whereClause, params.limit);
      return { success: true, data: items };
    } catch (error) {
      console.error("Failed to fetch feed events:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch feed events";
      return { success: false, error: message };
    }
  },

  async getEventById(id: number): Promise<ServiceResponse<FeedItemRecord | null>> {
    try {
      const item = await feedRepo.findById(id);
      return { success: true, data: item };
    } catch (error) {
      console.error("Failed to fetch feed event:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch feed event";
      return { success: false, error: message };
    }
  },

  async getEventsByEntity(entityId: string): Promise<ServiceResponse<FeedItemRecord[]>> {
    try {
      const items = await feedRepo.findByEntityId(entityId);
      return { success: true, data: items };
    } catch (error) {
      console.error("Failed to fetch entity events:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch entity events";
      return { success: false, error: message };
    }
  },
};
