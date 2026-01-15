import { ipcMain } from "electron";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db/client";
import { moods, accounts } from "../db/schema";
import { nanoid } from "nanoid";

const ACCOUNT_ID = "default";

type MoodPayload = {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
  uiConfig?: string;
  sortOrder?: number;
};

type MoodRecord = typeof moods.$inferSelect;

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeMoodPayload(payload: unknown): {
  data: Partial<MoodPayload>;
  errors: Record<string, string>;
} {
  if (typeof payload !== "object" || payload === null) {
    return { data: {}, errors: { body: "Invalid payload" } };
  }

  const raw = payload as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const data: Partial<MoodPayload> = {};

  // Name (required)
  const name = sanitizeString(raw.name, 100);
  if (!name || name === "") {
    errors.name = "Name is required";
  } else {
    data.name = name;
  }

  // Slug (optional, will be auto-generated if not provided)
  const slug = sanitizeString(raw.slug, 100);
  if (slug) {
    data.slug = slug;
  }

  // Description (optional)
  const description = sanitizeString(raw.description, 500);
  if (description) {
    data.description = description;
  }

  // System Prompt (optional)
  const systemPrompt = sanitizeString(raw.systemPrompt, 10000);
  if (systemPrompt) {
    data.systemPrompt = systemPrompt;
  }

  // Model (optional)
  const model = sanitizeString(raw.model, 100);
  if (model) {
    data.model = model;
  }

  // Icon (optional)
  const icon = sanitizeString(raw.icon, 10);
  if (icon) {
    data.icon = icon;
  }

  // Theme Config (optional, should be valid JSON)
  if (typeof raw.themeConfig === "string" && raw.themeConfig) {
    try {
      JSON.parse(raw.themeConfig);
      data.themeConfig = raw.themeConfig;
    } catch {
      errors.themeConfig = "Invalid JSON format";
    }
  }

  // UI Config (optional, should be valid JSON)
  if (typeof raw.uiConfig === "string" && raw.uiConfig) {
    try {
      JSON.parse(raw.uiConfig);
      data.uiConfig = raw.uiConfig;
    } catch {
      errors.uiConfig = "Invalid JSON format";
    }
  }

  // Sort Order (optional)
  if (typeof raw.sortOrder === "number") {
    data.sortOrder = raw.sortOrder;
  }

  return { data, errors };
}

export function registerMoodHandlers() {
  // Get all moods
  ipcMain.handle("mood:getAll", async () => {
    try {
      const db = getDb();
      const result = await db.query.moods.findMany({
        where: eq(moods.accountId, ACCOUNT_ID),
        orderBy: [moods.sortOrder, desc(moods.createdAt)],
      });

      return { success: true, data: result };
    } catch (error) {
      console.error("Error fetching moods:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Get mood by ID
  ipcMain.handle("mood:getById", async (_event, moodId: string) => {
    try {
      const db = getDb();
      const result = await db.query.moods.findFirst({
        where: and(eq(moods.id, moodId), eq(moods.accountId, ACCOUNT_ID)),
      });

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
  });

  // Create mood
  ipcMain.handle("mood:create", async (_event, payload: unknown) => {
    try {
      const { data, errors } = sanitizeMoodPayload(payload);

      if (Object.keys(errors).length > 0) {
        return { success: false, errors };
      }

      if (!data.name) {
        return { success: false, errors: { name: "Name is required" } };
      }

      const db = getDb();

      // Generate slug if not provided
      const slug = data.slug || generateSlug(data.name);

      // Check if slug already exists
      const existing = await db.query.moods.findFirst({
        where: and(eq(moods.accountId, ACCOUNT_ID), eq(moods.slug, slug)),
      });

      if (existing) {
        return {
          success: false,
          errors: { slug: "A mood with this slug already exists" },
        };
      }

      // Get max sort order
      const maxOrderResult = await db
        .select({ maxOrder: moods.sortOrder })
        .from(moods)
        .where(eq(moods.accountId, ACCOUNT_ID))
        .orderBy(desc(moods.sortOrder))
        .limit(1);

      const nextOrder =
        maxOrderResult.length > 0 && maxOrderResult[0].maxOrder !== null
          ? maxOrderResult[0].maxOrder + 1
          : 0;

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

      await db.insert(moods).values(newMood);

      const created = await db.query.moods.findFirst({
        where: eq(moods.id, newMood.id),
      });

      return { success: true, data: created };
    } catch (error) {
      console.error("Error creating mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Update mood
  ipcMain.handle(
    "mood:update",
    async (_event, moodId: string, payload: unknown) => {
      try {
        const { data, errors } = sanitizeMoodPayload(payload);

        if (Object.keys(errors).length > 0) {
          return { success: false, errors };
        }

        const db = getDb();

        // Check if mood exists
        const existing = await db.query.moods.findFirst({
          where: and(eq(moods.id, moodId), eq(moods.accountId, ACCOUNT_ID)),
        });

        if (!existing) {
          return { success: false, error: "Mood not found" };
        }

        // If slug is being changed, check if new slug already exists
        if (data.slug && data.slug !== existing.slug) {
          const slugExists = await db.query.moods.findFirst({
            where: and(
              eq(moods.accountId, ACCOUNT_ID),
              eq(moods.slug, data.slug)
            ),
          });

          if (slugExists) {
            return {
              success: false,
              errors: { slug: "A mood with this slug already exists" },
            };
          }
        }

        // Update mood
        await db
          .update(moods)
          .set({
            ...data,
            slug:
              data.slug || (data.name ? generateSlug(data.name) : undefined),
          })
          .where(eq(moods.id, moodId));

        const updated = await db.query.moods.findFirst({
          where: eq(moods.id, moodId),
        });

        return { success: true, data: updated };
      } catch (error) {
        console.error("Error updating mood:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }
  );

  // Delete mood
  ipcMain.handle("mood:delete", async (_event, moodId: string) => {
    try {
      const db = getDb();

      // Check if mood exists
      const existing = await db.query.moods.findFirst({
        where: and(eq(moods.id, moodId), eq(moods.accountId, ACCOUNT_ID)),
      });

      if (!existing) {
        return { success: false, error: "Mood not found" };
      }

      await db.delete(moods).where(eq(moods.id, moodId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  // Archive mood
  ipcMain.handle("mood:archive", async (_event, moodId: string) => {
    try {
      const db = getDb();

      const existing = await db.query.moods.findFirst({
        where: and(eq(moods.id, moodId), eq(moods.accountId, ACCOUNT_ID)),
      });

      if (!existing) {
        return { success: false, error: "Mood not found" };
      }

      await db
        .update(moods)
        .set({ isArchived: true })
        .where(eq(moods.id, moodId));

      return { success: true };
    } catch (error) {
      console.error("Error archiving mood:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  console.log("Mood handlers registered");
}
