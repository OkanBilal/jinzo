import { ipcMain } from "electron";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { entities, playlistItems } from "../../db/schema";

export function registerPlaylistHandlers() {
  // Get playlist items for a specific playlist
  ipcMain.handle("playlists:getItems", async (_, playlistEntityId: string) => {
    try {
      const db = getDb();
      const items = await db
        .select({
          playlistItem: playlistItems,
          entity: entities,
        })
        .from(playlistItems)
        .innerJoin(entities, eq(playlistItems.itemEntityId, entities.id))
        .where(
          and(
            eq(playlistItems.playlistEntityId, playlistEntityId),
            eq(entities.isDeleted, false)
          )
        )
        .orderBy(playlistItems.position);

      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching playlist items:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Add item to playlist
  ipcMain.handle(
    "playlists:addItem",
    async (
      _,
      playlistEntityId: string,
      itemEntityId: string,
      position?: number
    ) => {
      try {
        const db = getDb();

        // Get max position if not provided
        let targetPosition = position;
        if (targetPosition === undefined) {
          const maxPos = await db
            .select({ maxPosition: sql<number>`MAX(${playlistItems.position})` })
            .from(playlistItems)
            .where(eq(playlistItems.playlistEntityId, playlistEntityId));

          targetPosition = (maxPos[0]?.maxPosition ?? -1) + 1;
        }

        await db.insert(playlistItems).values({
          playlistEntityId,
          itemEntityId,
          position: targetPosition,
        });

        return { success: true };
      } catch (error) {
        console.error("Error adding playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Remove item from playlist
  ipcMain.handle(
    "playlists:removeItem",
    async (_, playlistEntityId: string, itemEntityId: string) => {
      try {
        const db = getDb();

        await db
          .delete(playlistItems)
          .where(
            and(
              eq(playlistItems.playlistEntityId, playlistEntityId),
              eq(playlistItems.itemEntityId, itemEntityId)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("Error removing playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Reorder playlist item
  ipcMain.handle(
    "playlists:reorderItem",
    async (
      _,
      playlistEntityId: string,
      itemEntityId: string,
      newPosition: number
    ) => {
      try {
        const db = getDb();

        await db
          .update(playlistItems)
          .set({ position: newPosition })
          .where(
            and(
              eq(playlistItems.playlistEntityId, playlistEntityId),
              eq(playlistItems.itemEntityId, itemEntityId)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("Error reordering playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );
}

export function unregisterPlaylistHandlers() {
  ipcMain.removeHandler("playlists:getItems");
  ipcMain.removeHandler("playlists:addItem");
  ipcMain.removeHandler("playlists:removeItem");
  ipcMain.removeHandler("playlists:reorderItem");
}
