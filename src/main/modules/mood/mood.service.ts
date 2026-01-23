import { nanoid } from "nanoid";
import { moodRepo } from "./mood.repo";
import { ACCOUNT_ID } from "./mood.constants";
import { sanitizeMoodPayload, generateSlug } from "./mood.validation";
import type { MoodRecord, ServiceResponse } from "./mood.dto";

// ─────────────────────────────────────────────────────────────
// Mood Service
// ─────────────────────────────────────────────────────────────
export const moodService = {
  async getAll(): Promise<ServiceResponse<MoodRecord[]>> {
    try {
      const result = await moodRepo.findAll();
      return { success: true, data: result };
    } catch (error) {
      console.error("Error fetching moods:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async getById(moodId: string): Promise<ServiceResponse<MoodRecord>> {
    try {
      const result = await moodRepo.findById(moodId);

      if (!result) {
        return { success: false, error: "Mood not found" };
      }

      return { success: true, data: result };
    } catch (error) {
      console.error("Error fetching mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async create(payload: unknown): Promise<ServiceResponse<MoodRecord>> {
    try {
      const { data, errors } = sanitizeMoodPayload(payload);

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      if (!data.name) {
        return { success: false, errors: { name: "Name is required" } };
      }

      // Generate slug if not provided
      const slug = data.slug || generateSlug(data.name);

      // Check if slug already exists
      const existing = await moodRepo.findBySlug(slug);
      if (existing) {
        return {
          success: false,
          errors: { slug: "A mood with this slug already exists" },
        };
      }

      // Get next sort order
      const nextOrder = await moodRepo.getMaxSortOrder();

      const newMood = {
        id: nanoid(),
        accountId: ACCOUNT_ID,
        name: data.name,
        slug,
        description: data.description || null,
        systemPrompt: data.systemPrompt || null,
        model: data.model || null,
        icon: data.icon || null,
        themeConfig: data.themeConfig || null,
        uiConfig: data.uiConfig || null,
        sortOrder: data.sortOrder ?? nextOrder,
      };

      await moodRepo.create(newMood);

      const created = await moodRepo.findById(newMood.id);
      if (!created) {
        return { success: false, error: "Failed to create mood" };
      }

      return { success: true, data: created };
    } catch (error) {
      console.error("Error creating mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async update(
    moodId: string,
    payload: unknown
  ): Promise<ServiceResponse<MoodRecord>> {
    try {
      const { data, errors } = sanitizeMoodPayload(payload);

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      // Check if mood exists
      const existing = await moodRepo.findById(moodId);
      if (!existing) {
        return { success: false, error: "Mood not found" };
      }

      // If slug is being changed, check if new slug already exists
      if (data.slug && data.slug !== existing.slug) {
        const slugExists = await moodRepo.findBySlug(data.slug);
        if (slugExists) {
          return {
            success: false,
            errors: { slug: "A mood with this slug already exists" },
          };
        }
      }

      // Update mood
      await moodRepo.update(moodId, {
        ...data,
        slug: data.slug || (data.name ? generateSlug(data.name) : undefined),
      });

      const updated = await moodRepo.findById(moodId);
      if (!updated) {
        return { success: false, error: "Failed to update mood" };
      }

      return { success: true, data: updated };
    } catch (error) {
      console.error("Error updating mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async delete(moodId: string): Promise<ServiceResponse<void>> {
    try {
      const existing = await moodRepo.findById(moodId);
      if (!existing) {
        return { success: false, error: "Mood not found" };
      }

      await moodRepo.delete(moodId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error deleting mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async archive(moodId: string): Promise<ServiceResponse<void>> {
    try {
      const existing = await moodRepo.findById(moodId);
      if (!existing) {
        return { success: false, error: "Mood not found" };
      }

      await moodRepo.archive(moodId);
      return { success: true, data: undefined };
    } catch (error) {
      console.error("Error archiving mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
