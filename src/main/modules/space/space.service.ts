import { nanoid } from "nanoid";
import { spaceRepo } from "./space.repo";
import { ACCOUNT_ID } from "./space.constants";
import { sanitizeSpacePayload, generateSlug } from "./space.validation";
import type { SpaceRecord } from "./space.dto";

function flattenFieldErrors(errors: Record<string, string>): string {
  return Object.entries(errors)
    .map(([field, msg]) => `${field}: ${msg}`)
    .join("; ");
}

// ─────────────────────────────────────────────────────────────
// Space Service
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// Reads return null for absence; mutations on a missing target throw
// (see CONTEXT.md "absence rule").
// ─────────────────────────────────────────────────────────────
export const spaceService = {
  async getAll(): Promise<SpaceRecord[]> {
    return spaceRepo.findAll();
  },

  async getById(spaceId: string): Promise<SpaceRecord | null> {
    return (await spaceRepo.findById(spaceId)) ?? null;
  },

  async create(payload: unknown): Promise<SpaceRecord> {
    const { data, errors } = sanitizeSpacePayload(payload);

    if (Object.keys(errors).length > 0) {
      throw new Error(flattenFieldErrors(errors));
    }

    if (!data.name) {
      throw new Error("name: Name is required");
    }

    // Generate slug if not provided
    const slug = data.slug || generateSlug(data.name);

    // Check if slug already exists
    const existing = await spaceRepo.findBySlug(slug);
    if (existing) {
      throw new Error("slug: A space with this slug already exists");
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
    if (!created) throw new Error("Failed to create space");
    return created;
  },

  async update(spaceId: string, payload: unknown): Promise<SpaceRecord> {
    const { data, errors } = sanitizeSpacePayload(payload);

    if (Object.keys(errors).length > 0) {
      throw new Error(flattenFieldErrors(errors));
    }

    const existing = await spaceRepo.findById(spaceId);
    if (!existing) throw new Error("Space not found");

    // If slug is being changed, check if new slug already exists
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await spaceRepo.findBySlug(data.slug);
      if (slugExists) {
        throw new Error("slug: A space with this slug already exists");
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
    if (!updated) throw new Error("Failed to update space");
    return updated;
  },

  async delete(spaceId: string): Promise<void> {
    const existing = await spaceRepo.findById(spaceId);
    if (!existing) throw new Error("Space not found");

    await spaceRepo.delete(spaceId);
  },

  async archive(spaceId: string): Promise<void> {
    const existing = await spaceRepo.findById(spaceId);
    if (!existing) throw new Error("Space not found");

    await spaceRepo.archive(spaceId);
  },

  async unarchive(spaceId: string): Promise<void> {
    const existing = await spaceRepo.findById(spaceId);
    if (!existing) throw new Error("Space not found");

    await spaceRepo.unarchive(spaceId);
  },
};
