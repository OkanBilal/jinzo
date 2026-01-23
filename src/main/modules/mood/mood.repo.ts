import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { moods } from "../../db/schema";
import { ACCOUNT_ID } from "./mood.constants";
import type { MoodRecord, MoodPayload } from "./mood.dto";

// ─────────────────────────────────────────────────────────────
// Mood Repository
// ─────────────────────────────────────────────────────────────
export const moodRepo = {
  async findAll(): Promise<MoodRecord[]> {
    const db = getDb();
    return db.query.moods.findMany({
      where: eq(moods.accountId, ACCOUNT_ID),
      orderBy: [moods.sortOrder, desc(moods.createdAt)],
    }) as Promise<MoodRecord[]>;
  },

  async findById(moodId: string): Promise<MoodRecord | undefined> {
    const db = getDb();
    return db.query.moods.findFirst({
      where: and(eq(moods.id, moodId), eq(moods.accountId, ACCOUNT_ID)),
    }) as Promise<MoodRecord | undefined>;
  },

  async findBySlug(slug: string): Promise<MoodRecord | undefined> {
    const db = getDb();
    return db.query.moods.findFirst({
      where: and(eq(moods.accountId, ACCOUNT_ID), eq(moods.slug, slug)),
    }) as Promise<MoodRecord | undefined>;
  },

  async getMaxSortOrder(): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ maxOrder: moods.sortOrder })
      .from(moods)
      .where(eq(moods.accountId, ACCOUNT_ID))
      .orderBy(desc(moods.sortOrder))
      .limit(1);

    return result.length > 0 && result[0].maxOrder !== null
      ? result[0].maxOrder + 1
      : 0;
  },

  async create(data: {
    id: string;
    accountId: string;
    name: string;
    slug: string;
    description: string | null;
    systemPrompt: string | null;
    model: string | null;
    icon: string | null;
    themeConfig: string | null;
    uiConfig: string | null;
    sortOrder: number;
  }): Promise<void> {
    const db = getDb();
    await db.insert(moods).values(data);
  },

  async update(
    moodId: string,
    data: Partial<MoodPayload> & { slug?: string }
  ): Promise<void> {
    const db = getDb();
    await db.update(moods).set(data).where(eq(moods.id, moodId));
  },

  async delete(moodId: string): Promise<void> {
    const db = getDb();
    await db.delete(moods).where(eq(moods.id, moodId));
  },

  async archive(moodId: string): Promise<void> {
    const db = getDb();
    await db
      .update(moods)
      .set({ isArchived: true })
      .where(eq(moods.id, moodId));
  },
};
