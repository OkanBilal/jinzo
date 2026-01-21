import { ipcMain } from "electron";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../../db/client";
import { moods } from "../../db/schema";
import { ACCOUNT_ID } from "./constants";
import { sanitizeMoodPayload, generateSlug } from "./utils";

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

export function unregisterMoodHandlers() {
  ipcMain.removeHandler("mood:getAll");
  ipcMain.removeHandler("mood:getById");
  ipcMain.removeHandler("mood:create");
  ipcMain.removeHandler("mood:update");
  ipcMain.removeHandler("mood:delete");
  ipcMain.removeHandler("mood:archive");
}
