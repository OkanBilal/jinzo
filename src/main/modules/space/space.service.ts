import { nanoid } from "nanoid";
import { spaceRepo } from "./space.repo";
import { ACCOUNT_ID } from "./space.constants";
import { sanitizeSpacePayload, generateSlug } from "./space.validation";
import { ok, fail } from "../../../shared/ipc-kit/service-response";
import type { SpaceRecord, ServiceResponse } from "./space.dto";

function flattenFieldErrors(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, msg]) => `${field}: ${msg}`)
    .join("; ");
}

// ─────────────────────────────────────────────────────────────
// Space Service
// ─────────────────────────────────────────────────────────────
export const spaceService = {
  async getAll(): Promise<ServiceResponse<SpaceRecord[]>> {
    try {
      const result = await spaceRepo.findAll();
      return ok(result);
    } catch (error) {
      console.error("Error fetching spaces:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async getById(spaceId: string): Promise<ServiceResponse<SpaceRecord>> {
    try {
      const result = await spaceRepo.findById(spaceId);
      if (!result) return fail("Space not found");
      return ok(result);
    } catch (error) {
      console.error("Error fetching space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async create(payload: unknown): Promise<ServiceResponse<SpaceRecord>> {
    try {
      const { data, errors } = sanitizeSpacePayload(payload);

      if (Object.keys(errors).length > 0) {
        return fail(flattenFieldErrors(errors));
      }

      if (!data.name) {
        return fail("name: Name is required");
      }

      // Generate slug if not provided
      const slug = data.slug || generateSlug(data.name);

      // Check if slug already exists
      const existing = await spaceRepo.findBySlug(slug);
      if (existing) {
        return fail("slug: A space with this slug already exists");
      }

      // Get next sort order
      const nextOrder = await spaceRepo.getMaxSortOrder();

      const newSpace = {
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

      await spaceRepo.create(newSpace);

      const created = await spaceRepo.findById(newSpace.id);
      if (!created) return fail("Failed to create space");
      return ok(created);
    } catch (error) {
      console.error("Error creating space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async update(
    spaceId: string,
    payload: unknown
  ): Promise<ServiceResponse<SpaceRecord>> {
    try {
      const { data, errors } = sanitizeSpacePayload(payload);

      if (Object.keys(errors).length > 0) {
        return fail(flattenFieldErrors(errors));
      }

      // Check if space exists
      const existing = await spaceRepo.findById(spaceId);
      if (!existing) return fail("Space not found");

      // If slug is being changed, check if new slug already exists
      if (data.slug && data.slug !== existing.slug) {
        const slugExists = await spaceRepo.findBySlug(data.slug);
        if (slugExists) {
          return fail("slug: A space with this slug already exists");
        }
      }

      // Update space (only set slug when provided or implied by a new name)
      const updatePayload: typeof data = { ...data };
      if (data.slug) {
        updatePayload.slug = data.slug;
      } else if (data.name) {
        updatePayload.slug = generateSlug(data.name);
      }
      await spaceRepo.update(spaceId, updatePayload);

      const updated = await spaceRepo.findById(spaceId);
      if (!updated) return fail("Failed to update space");
      return ok(updated);
    } catch (error) {
      console.error("Error updating space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async delete(spaceId: string): Promise<ServiceResponse<void>> {
    try {
      const existing = await spaceRepo.findById(spaceId);
      if (!existing) return fail("Space not found");

      await spaceRepo.delete(spaceId);
      return ok(undefined);
    } catch (error) {
      console.error("Error deleting space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async archive(spaceId: string): Promise<ServiceResponse<void>> {
    try {
      const existing = await spaceRepo.findById(spaceId);
      if (!existing) return fail("Space not found");

      await spaceRepo.archive(spaceId);
      return ok(undefined);
    } catch (error) {
      console.error("Error archiving space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },

  async unarchive(spaceId: string): Promise<ServiceResponse<void>> {
    try {
      const existing = await spaceRepo.findById(spaceId);
      if (!existing) return fail("Space not found");

      await spaceRepo.unarchive(spaceId);
      return ok(undefined);
    } catch (error) {
      console.error("Error unarchiving space:", error);
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },
};
